// src/controllers/stripe.controller.js
import Stripe from "stripe";
import dotenv from "dotenv";
import User from "../models/user.model.js";
import { syncUserPremiumStatus } from "../utils/syncUserPremiumStatus.js";

// Banners
import AdBanner from "../models/adBanner.model.js";
import { getPriceCentsForPlacement } from "../config/adPricing.js";
import { getPriceIdForPlacement } from "../config/stripePrices.js";
import { sendAdPublishedUserEmail } from "../services/adMailer.service.js";

// Carga .env y permite override (útil en Windows si hay vars del sistema)
dotenv.config({ override: true });

const {
  STRIPE_SECRET_KEY,
  STRIPE_PREMIUM_PRICE_ID,
  STRIPE_WEBHOOK_SECRET,
  FRONTEND_URL,
  NODE_ENV,
  DEBUG_STRIPE,
} = process.env;

if (
  !STRIPE_SECRET_KEY ||
  !STRIPE_PREMIUM_PRICE_ID ||
  !STRIPE_WEBHOOK_SECRET ||
  !FRONTEND_URL
) {
  throw new Error("🚨 Falta configurar variables de entorno para Stripe");
}

// Inicializa Stripe con versión fija
const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });

// Diagnóstico al arrancar (cuenta y prefijo de la key)
(async () => {
  try {
    const acct = await stripe.accounts.retrieve();
    console.log(
      `[Stripe] acct: ${acct.id} | key: ${STRIPE_SECRET_KEY.slice(
        0,
        7
      )} | env: ${NODE_ENV || "dev"}`
    );
  } catch (e) {
    console.warn("[Stripe] No se pudo leer la cuenta:", e.message);
  }
})();

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

async function activateBannerAndNotify(banner, months = 1) {
  const start = banner.startAt || new Date();
  const end = new Date(start);
  end.setMonth(end.getMonth() + months);

  banner.startAt = start;
  banner.endAt = end;
  banner.status = "active";
  banner.isActive = true;
  await banner.save();

  try {
    const owner = await User.findById(banner.createdBy).select(
      "email name fullName"
    );
    if (owner?.email) {
      const dashboardUrl = buildUrl(FRONTEND_URL, "/dashboard/mis-banners", {
        highlight: banner._id.toString(),
      });
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
    console.error("✉️  Error email publicación:", mailErr.message);
  }

  console.log("✅ Banner activado:", banner._id.toString());
}

/* ======================================================
   Crear sesión de Checkout para PREMIUM (SUBSCRIPCIÓN)
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
      line_items: [{ price: STRIPE_PREMIUM_PRICE_ID, quantity: 1 }],
      customer_email: user.email,
      metadata: { userId: user._id.toString() },
      success_url: `${cleanFrontendUrl}/suscripcion-exitosa`,
      cancel_url: `${cleanFrontendUrl}/suscripcion-cancelada`,
    });

    res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error("❌ Error creando sesión Stripe (premium):", error);
    res.status(500).json({ message: "Error al iniciar sesión de pago" });
  }
};

/* =====================================================
   Checkout para BANNERS (pago único de 1 mes)
   ===================================================== */
export const createBannerCheckoutSession = async (req, res) => {
  try {
    const user = req.user;
    const { bannerId } = req.body || {};
    if (!user || !user._id)
      return res.status(400).json({ msg: "Usuario inválido" });
    if (!bannerId) return res.status(400).json({ msg: "bannerId requerido" });

    const banner = await AdBanner.findById(bannerId);
    if (!banner) return res.status(404).json({ msg: "Banner no encontrado" });

    // Permisos: dueño del banner o admin
    const isOwner =
      banner.createdBy?.toString?.() === (user?.id || user?._id?.toString());
    const isAdmin = user?.role === "admin";
    if (!isOwner && !isAdmin)
      return res.status(403).json({ msg: "Sin permisos" });

    // Debe estar aprobado para pagar
    if (!["approved", "awaiting_payment"].includes(banner.status)) {
      return res
        .status(400)
        .json({ msg: "El banner no está aprobado para pago" });
    }

    // Precio (en centavos)
    const amount =
      Number.isInteger(banner.priceCents) && banner.priceCents > 0
        ? banner.priceCents
        : getPriceCentsForPlacement(banner.placement);
    const currency = (banner.currency || "usd").toLowerCase();
    if (!Number.isInteger(amount) || amount <= 0) {
      return res.status(400).json({ msg: "Monto inválido para checkout" });
    }

    const priceId = getPriceIdForPlacement(banner.placement);

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
      // 👇 Fallback si metadata no llega: lo leeremos en el webhook
      client_reference_id: banner._id.toString(),
      metadata: {
        kind: "banner_payment",
        bannerId: banner._id.toString(),
        placement: banner.placement || "",
        months: "1",
      },
    };

    const line_items = priceId
      ? [{ quantity: 1, price: priceId }]
      : [
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
  const dlog = (...args) =>
    DEBUG_STRIPE === "1" && console.log("[STRIPE]", ...args);
  const IS_PROD = NODE_ENV === "production";
  const ACK = () => res.status(200).json({ received: true });

  const sig = req.headers["stripe-signature"];
  let event;

  try {
    // ⚠️ Esta ruta DEBE usar express.raw({ type: 'application/json' })
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Firma inválida del webhook:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  dlog("→ EVENT", { id: event.id, type: event.type, livemode: event.livemode });
  const data = event.data.object;
  dlog("→ DATA SNAPSHOT", {
    mode: data?.mode,
    payment_status: data?.payment_status,
    status: data?.status,
    metadata: data?.metadata,
    client_reference_id: data?.client_reference_id,
    object: data?.object,
  });

  try {
    switch (event.type) {
      // Considera ambos eventos de checkout exitoso
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object; // 'checkout.session'
        const paid =
          session.payment_status === "paid" || session.status === "complete";
        const mode = session.mode; // 'payment' | 'subscription'
        // ✅ elegir bannerId desde metadata o client_reference_id (fallback)
        const bannerId =
          session.metadata?.bannerId || session.client_reference_id || null;
        const months = parseInt(session.metadata?.months || "1", 10) || 1;

        console.log("[webhook] checkout.session.*", {
          id: session.id,
          livemode: event.livemode,
          mode,
          payment_status: session.payment_status,
          hasMetadataBanner: !!session.metadata?.bannerId,
          client_reference_id: session.client_reference_id || null,
          pickedBannerId: bannerId || null,
        });

        if (!paid) return ACK();

        // 🔸 Activar PREMIUM (suscripciones)
        if (mode === "subscription") {
          try {
            const userId = session.metadata?.userId;
            const subscriptionId = session.subscription; // viene en la session
            if (userId && subscriptionId) {
              const user = await User.findById(userId);
              if (user) {
                user.isPremium = true;
                user.subscriptionId = subscriptionId;
                await user.save();
                await syncUserPremiumStatus(user._id, true);
                console.log(`✅ Premium activado: ${user.email}`);
              }
            } else {
              console.log(
                "ℹ️ Suscripción sin userId/subscriptionId (posible checkout fuera de tu endpoint)."
              );
            }
          } catch (e) {
            console.error("⚠️ Error activando premium:", e.message);
            if (IS_PROD)
              return res.status(500).json({ msg: "Error activando premium" });
          }
        }

        // 🔸 Activar BANNER (pago único)
        if (mode === "payment") {
          if (!bannerId) {
            console.log(
              "ℹ️ Pago sin bannerId (ni metadata ni client_reference_id). No se puede activar automáticamente."
            );
            return ACK();
          }

          try {
            const banner = await AdBanner.findById(bannerId);
            if (!banner) {
              console.log("⚠️ Banner no encontrado:", bannerId);
              return ACK();
            }
            if (banner.status !== "active") {
              await activateBannerAndNotify(banner, months);
            } else {
              console.log("ℹ️ Banner ya estaba activo:", banner._id.toString());
            }
          } catch (e) {
            console.error("⚠️ Error activando banner:", e.message);
            if (IS_PROD)
              return res.status(500).json({ msg: "Error activando banner" });
          }
        }

        return ACK();
      }

      case "payment_intent.succeeded": {
        // Backup para métodos asíncronos: mapear intent -> session
        const intent = event.data.object;
        console.log("[webhook] payment_intent.succeeded", {
          intent: intent.id,
          status: intent.status,
          livemode: event.livemode,
        });

        try {
          const sessions = await stripe.checkout.sessions.list({
            payment_intent: intent.id,
            limit: 1,
          });
          const s = sessions.data?.[0];
          const md = s?.metadata || {};
          const bannerId = md.bannerId || s?.client_reference_id || null;

          if (!s || s.payment_status !== "paid" || !bannerId) return ACK();

          const banner = await AdBanner.findById(bannerId);
          if (!banner || banner.status === "active") return ACK();

          const months = parseInt(md.months || "1", 10) || 1;
          await activateBannerAndNotify(banner, months);

          return ACK();
        } catch (e) {
          console.error("⚠️ No se pudo mapear intent->session:", e.message);
          // En dev, no fuerces reintento
          return IS_PROD
            ? res.status(500).json({ msg: "Error mapeando intent" })
            : ACK();
        }
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        try {
          const user = await User.findOne({ subscriptionId: sub.id });
          if (user) {
            user.isPremium = false;
            user.subscriptionId = null;
            await user.save();
            await syncUserPremiumStatus(user._id, false);
            console.log(`🛑 Premium cancelado para: ${user.email}`);
          }
        } catch (err) {
          console.error("⚠️ Error al manejar subscription.deleted:", err);
          if (IS_PROD)
            return res.status(500).json({ msg: "Error en baja de premium" });
        }
        return ACK();
      }

      default:
        console.log(`🔔 Evento no manejado: ${event.type}`);
        return ACK();
    }
  } catch (err) {
    console.error("❌ stripeWebhookHandler:", err);
    // En dev, nunca 500 por errores esperables
    if (!IS_PROD) return ACK();
    return res.status(500).json({ msg: "Error procesando webhook" });
  }
};
