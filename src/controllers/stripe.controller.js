// src/controllers/stripeController.js
import Stripe from "stripe";
import dotenv from "dotenv";
import User from "../models/user.model.js";
import { syncUserPremiumStatus } from "../utils/syncUserPremiumStatus.js";

// Banners
import AdBanner from "../models/adBanner.model.js";
import { getPriceCentsForPlacement } from "../config/adPricing.js";
import { getPriceIdForPlacement } from "../config/stripePrices.js";
import { sendAdPublishedUserEmail } from "../services/adMailer.service.js";

dotenv.config();

const {
  STRIPE_SECRET_KEY,
  STRIPE_PREMIUM_PRICE_ID,
  STRIPE_WEBHOOK_SECRET,
  FRONTEND_URL,
} = process.env;

if (
  !STRIPE_SECRET_KEY ||
  !STRIPE_PREMIUM_PRICE_ID ||
  !STRIPE_WEBHOOK_SECRET ||
  !FRONTEND_URL
) {
  throw new Error("🚨 Falta configurar variables de entorno para Stripe");
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

/* =========================
   Helpers (URLs y fechas)
   ========================= */
function ensureUrlWithScheme(u) {
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  const isLocal = /^localhost(:\d+)?(\/|$)/i.test(u);
  return `${isLocal ? "http" : "https"}://${u.replace(/^\/+/, "")}`;
}

function buildUrl(base, path = "/", params = {}) {
  const origin = ensureUrlWithScheme(base) || "http://localhost:5173";
  const url = new URL(path, origin);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") {
      url.searchParams.set(k, String(v));
    }
  });
  return url.toString();
}

function addMonths(date, months = 1) {
  const d = new Date(date || Date.now());
  d.setMonth(d.getMonth() + months);
  return d;
}

/* ======================================================
   EXISTENTE: Crear sesión de Checkout para PREMIUM (SUB)
   ====================================================== */
export const createCheckoutSession = async (req, res) => {
  try {
    const user = req.user;
    if (!user || !user.email) {
      return res.status(400).json({ message: "Usuario inválido" });
    }

    const cleanFrontendUrl = FRONTEND_URL.endsWith("/")
      ? FRONTEND_URL.slice(0, -1)
      : FRONTEND_URL;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [
        {
          price: STRIPE_PREMIUM_PRICE_ID, // <- price_id de Stripe para tu plan premium
          quantity: 1,
        },
      ],
      customer_email: user.email,
      metadata: {
        userId: user._id.toString(),
      },
      success_url: `${cleanFrontendUrl}/suscripcion-exitosa`,
      cancel_url: `${cleanFrontendUrl}/suscripcion-cancelada`,
    });

    res.status(200).json({ url: session.url });
  } catch (error) {
    console.error("❌ Error creando sesión Stripe:", error);
    res.status(500).json({ message: "Error al iniciar sesión de pago" });
  }
};

/* =====================================================
   NUEVO: Checkout para BANNERS (pago único de 1 mes)
   ===================================================== */
export const createBannerCheckoutSession = async (req, res) => {
  try {
    const user = req.user;
    const { bannerId } = req.body || {};
    if (!user || !user._id) {
      return res.status(400).json({ msg: "Usuario inválido" });
    }
    if (!bannerId) {
      return res.status(400).json({ msg: "bannerId requerido" });
    }

    const banner = await AdBanner.findById(bannerId);
    if (!banner) return res.status(404).json({ msg: "Banner no encontrado" });

    // Permisos: dueño del banner o admin
    const isOwner =
      banner.createdBy?.toString?.() === (user?.id || user?._id?.toString());
    const isAdmin = user?.role === "admin";
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ msg: "Sin permisos" });
    }

    // Debe estar aprobado para pagar
    if (!["approved", "awaiting_payment"].includes(banner.status)) {
      return res
        .status(400)
        .json({ msg: "El banner no está aprobado para pago" });
    }

    // Precio (en centavos) para fallback y para mostrar
    const amount =
      Number.isInteger(banner.priceCents) && banner.priceCents > 0
        ? banner.priceCents
        : getPriceCentsForPlacement(banner.placement);
    const currency = (banner.currency || "usd").toLowerCase();
    if (!Number.isInteger(amount) || amount <= 0) {
      return res.status(400).json({ msg: "Monto inválido para checkout" });
    }

    // Intentamos usar price_id por placement (Opción B)
    const priceId = getPriceIdForPlacement(banner.placement);

    // URLs absolutas (con esquema) para volver al dashboard
    const success_url = buildUrl(FRONTEND_URL, "/dashboard/mis-banners", {
      checkout: "success",
      bannerId: banner._id.toString(),
    });
    const cancel_url = buildUrl(FRONTEND_URL, "/dashboard/mis-banners", {
      checkout: "cancel",
      bannerId: banner._id.toString(),
    });

    // Imagen https (opcional)
    const img =
      banner.imageUrl ||
      banner.imageDesktopUrl ||
      banner.imageTabletUrl ||
      banner.imageMobileUrl ||
      undefined;

    const baseSessionPayload = {
      mode: "payment",
      success_url,
      cancel_url,
      client_reference_id: banner._id.toString(),
      metadata: {
        kind: "banner_payment",
        bannerId: banner._id.toString(),
        placement: banner.placement || "",
        months: "1", // vigencia 1 mes
      },
    };

    const line_items = priceId
      ? [
          {
            quantity: 1,
            price: priceId, // ✅ reutiliza price_id pre-creado
          },
        ]
      : [
          // Fallback seguro: crea el precio "al vuelo"
          {
            quantity: 1,
            price_data: {
              currency,
              unit_amount: amount,
              product_data: {
                name: `Banner ${banner.placement} – 1 mes`,
                description: banner.title || "Publicidad",
                ...(img ? { images: [img] } : {}),
              },
            },
          },
        ];

    const session = await stripe.checkout.sessions.create({
      ...baseSessionPayload,
      line_items,
    });

    if (banner.status !== "awaiting_payment") {
      banner.status = "awaiting_payment";
      await banner.save();
    }

    return res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error("❌ Error creando checkout de banner:", error);
    res
      .status(400)
      .json({ msg: error.message || "Error creando checkout de banner" });
  }
};

/* ============================================
   WEBHOOK: maneja Premium y pagos de Banners
   ============================================ */
export const stripeWebhookHandler = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Firma inválida del webhook:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const data = event.data.object;

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        // Dos flujos posibles:
        // 1) Suscripción Premium (mode: subscription o data.subscription presente)
        // 2) Pago de banner (metadata.kind === "banner_payment" o metadata.bannerId presente)
        const isSubscriptionFlow =
          data.mode === "subscription" || !!data.subscription;

        if (isSubscriptionFlow) {
          // === PREMIUM ===
          try {
            const userId = data.metadata?.userId;
            if (userId) {
              const user = await User.findById(userId);
              if (user) {
                user.isPremium = true;
                user.subscriptionId = data.subscription;
                await user.save();
                await syncUserPremiumStatus(user._id, true);
              }
            }
          } catch (err) {
            console.error("⚠️ Error actualizando usuario (premium):", err);
          }
        } else if (data.metadata?.bannerId) {
          // === BANNER (pago único por 1 mes) ===
          const bannerId = data.metadata.bannerId;
          const months = parseInt(data.metadata?.months || "1", 10) || 1;

          try {
            const banner = await AdBanner.findById(bannerId);
            if (banner) {
              // activa y setea vigencia
              const start = banner.startAt || new Date();
              const end = addMonths(start, months);

              banner.startAt = start;
              banner.endAt = end;
              banner.status = "active";
              banner.isActive = true;
              await banner.save();

              // Email al dueño notificando publicación
              try {
                const owner = await User.findById(banner.createdBy).select(
                  "email name fullName"
                );
                if (owner?.email) {
                  const dashboardUrl = buildUrl(
                    FRONTEND_URL,
                    "/dashboard/mis-banners",
                    { highlight: banner._id.toString() }
                  );

                  await sendAdPublishedUserEmail({
                    to: owner.email,
                    recipientName: owner.name || owner.fullName || "",
                    title: banner.title,
                    placement: banner.placement,
                    startAt: banner.startAt,
                    endAt: banner.endAt,
                    dashboardUrl,
                  });
                }
              } catch (mailErr) {
                console.error(
                  "✉️  Error enviando email de publicación:",
                  mailErr.message
                );
              }
            }
          } catch (err) {
            console.error("⚠️ Error activando banner:", err);
          }
        }

        break;
      }

      case "customer.subscription.deleted": {
        // === PREMIUM cancelado ===
        try {
          const user = await User.findOne({ subscriptionId: data.id });
          if (user) {
            user.isPremium = false;
            user.subscriptionId = null;
            await user.save();
            await syncUserPremiumStatus(user._id, false);
            console.log(`🛑 Premium cancelado para: ${user.email}`);
          }
        } catch (err) {
          console.error("⚠️ Error al manejar subscription.deleted:", err);
        }
        break;
      }

      default:
        console.log(`🔔 Evento no manejado: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error("❌ stripeWebhookHandler:", err);
    res.status(500).json({ msg: "Error procesando webhook" });
  }
};
