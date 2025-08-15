// src/controllers/ads.controller.js
import mongoose from "mongoose";
// import { v2 as cloudinary } from "cloudinary"; // ← si quieres borrar assets al eliminar/actualizar
import Stripe from "stripe";
import AdBanner, { AD_STATUS } from "../models/adBanner.model.js";
import {
  sendAdSubmittedAdminAlert,
  sendAdSubmittedUserReceipt,
} from "../services/adMailer.service.js";
import User from "../models/user.model.js";
import { getPriceCentsForPlacement } from "../config/adPricing.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────
function baseActiveFilter() {
  const now = new Date();
  return {
    isActive: true,
    $and: [
      { $or: [{ startAt: null }, { startAt: { $lte: now } }] },
      { $or: [{ endAt: null }, { endAt: { $gte: now } }] },
    ],
    $expr: {
      $and: [
        {
          $or: [
            { $eq: ["$maxImpressions", null] },
            { $lt: ["$impressions", "$maxImpressions"] },
          ],
        },
        {
          $or: [
            { $eq: ["$maxClicks", null] },
            { $lt: ["$clicks", "$maxClicks"] },
          ],
        },
      ],
    },
  };
}

function weightedPick(items) {
  const total = items.reduce((sum, it) => sum + Math.max(0, it.weight || 0), 0);
  if (total <= 0) return null;
  let rnd = Math.random() * total;
  for (const it of items) {
    rnd -= Math.max(0, it.weight || 0);
    if (rnd <= 0) return it;
  }
  return null;
}

function toIdArray(val) {
  if (Array.isArray(val)) return val.filter(Boolean);
  if (typeof val === "string") {
    return val
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function serializeAd(b) {
  return {
    id: b._id?.toString(),
    title: b.title,
    placement: b.placement,
    redirectUrl: b.redirectUrl,
    openInNewTab: b.openInNewTab,
    imageAlt: b.imageAlt || "",
    imageUrl: b.imageUrl || "", // compat con front actual

    // variantes opcionales por breakpoint (si no hay, usa default)
    sources: {
      desktop: b.imageDesktopUrl || b.imageUrl || "",
      tablet: b.imageTabletUrl || b.imageUrl || "",
      mobile: b.imageMobileUrl || b.imageUrl || "",
      default: b.imageUrl || "",
    },

    weight: b.weight ?? 1,
    isFallback: !!b.isFallback,

    // métricas (por si las quieres mostrar en admin)
    impressions: b.impressions ?? 0,
    clicks: b.clicks ?? 0,

    // segmentación (para admin)
    communities: b.communities ?? [],
    categories: b.categories ?? [],
    businesses: b.businesses ?? [],

    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}

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
    if (v !== undefined && v !== null && v !== "")
      url.searchParams.set(k, String(v));
  });
  return url.toString();
}

function addMonths(date, months = 1) {
  const d = new Date(date || Date.now());
  d.setMonth(d.getMonth() + months);
  return d;
}
// ─────────────────────────────────────────────────────────
// Crear banner
// ─────────────────────────────────────────────────────────
export const createAdBanner = async (req, res) => {
  try {
    const data = req.body?.data ? JSON.parse(req.body.data) : req.body || {};

    // Imágenes posibles según middleware:
    // - Single: req.bannerUpload.imageUrl
    // - Multi: req.body.imageUrl ( + imageDesktopUrl / imageTabletUrl / imageMobileUrl )
    const defaultImageUrl =
      req.body.imageUrl ||
      req?.bannerUpload?.imageUrl ||
      req.body.imageDesktopUrl ||
      req.body.imageTabletUrl ||
      req.body.imageMobileUrl ||
      "";

    if (!defaultImageUrl) {
      return res.status(400).json({ msg: "Falta la imagen del banner" });
    }
    const autoPrice = getPriceCentsForPlacement(data.placement);

    const banner = new AdBanner({
      currency: (data.currency || "usd").toLowerCase(),
      priceCents:
        Number.isInteger(data.priceCents) && data.priceCents > 0
          ? data.priceCents
          : autoPrice,
      status: "submitted",
      isActive: false, // ⬅️ ahora arranca inactivo
      isFallback: data.isFallback ?? false,
      status: "submitted", // ⬅️ flujo nuevo
      // campos base
      title: data.title,
      placement: data.placement,
      redirectUrl: data.redirectUrl,
      imageAlt: data.imageAlt || "",
      openInNewTab: data.openInNewTab ?? true,
      weight: data.weight ?? 1,
      maxImpressions: data.maxImpressions ?? null,
      maxClicks: data.maxClicks ?? null,
      startAt: data.startAt || null,
      endAt: data.endAt || null,
      isActive: data.isActive ?? true,
      isFallback: data.isFallback ?? false,

      // imágenes
      imageUrl: defaultImageUrl,
      publicId: req?.bannerUpload?.publicId || "",
      width: req?.bannerUpload?.width || null,
      height: req?.bannerUpload?.height || null,
      imageDesktopUrl: req.body.imageDesktopUrl ?? data.imageDesktopUrl ?? "",
      imageTabletUrl: req.body.imageTabletUrl ?? data.imageTabletUrl ?? "",
      imageMobileUrl: req.body.imageMobileUrl ?? data.imageMobileUrl ?? "",

      // segmentación
      communities: toIdArray(data.communities),
      categories: toIdArray(data.categories),
      businesses: toIdArray(data.businesses),

      // auditoría
      createdBy: req.user?._id || req.user?.id,
      createdByName: req.user?.name,
      createdByRole: req.user?.role,
    });

    await banner.save();
    try {
      // Admin alert
      await sendAdSubmittedAdminAlert({ banner, submitter: req.user });

      // Confirmación al usuario
      const submitter = await User.findById(banner.createdBy)
        .select("email name")
        .lean();
      if (submitter?.email) {
        await sendAdSubmittedUserReceipt({ banner, user: submitter });
      }
    } catch (e) {
      console.error("⚠️ Email (submit) error:", e.message);
    }
    // 🔔 Notifica al usuario y al admin (placeholders)

    return res.status(201).json({ msg: "Banner creado", banner });
  } catch (err) {
    console.error("❌ createAdBanner:", err);
    return res.status(500).json({ msg: "Error al crear banner" });
  }
};

// ─────────────────────────────────────────────────────────
// Listado (admin)
// ─────────────────────────────────────────────────────────
export const listAdBanners = async (req, res) => {
  try {
    const { placement, q, activeOnly } = req.query;
    const filter = {};
    if (placement) filter.placement = placement;
    if (activeOnly === "true") Object.assign(filter, baseActiveFilter());
    if (q) filter.title = { $regex: q, $options: "i" };

    const banners = await AdBanner.find(filter).sort({ createdAt: -1 });
    return res.json({ banners });
  } catch (err) {
    console.error("❌ listAdBanners:", err);
    return res.status(500).json({ msg: "Error al listar banners" });
  }
};

// ─────────────────────────────────────────────────────────
// Obtener por ID (admin)
// ─────────────────────────────────────────────────────────
export const getAdBannerById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ msg: "ID inválido" });
    }
    const banner = await AdBanner.findById(id);
    if (!banner) return res.status(404).json({ msg: "No encontrado" });
    return res.json({ banner });
  } catch (err) {
    console.error("❌ getAdBannerById:", err);
    return res.status(500).json({ msg: "Error" });
  }
};

// ─────────────────────────────────────────────────────────
// Actualizar (admin)
// ─────────────────────────────────────────────────────────
export const updateAdBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body?.data ? JSON.parse(req.body.data) : req.body || {};

    const banner = await AdBanner.findById(id);
    if (!banner) return res.status(404).json({ msg: "No encontrado" });

    const isOwner =
      banner.createdBy?.toString?.() ===
      (req.user?.id || req.user?._id?.toString());
    const isAdmin = req.user?.role === "admin";
    if (!isOwner && !isAdmin)
      return res.status(403).json({ msg: "Sin permisos" });

    const updatable = [
      "title",
      "placement",
      "redirectUrl",
      "imageAlt",
      "openInNewTab",
      "weight",
      "maxImpressions",
      "maxClicks",
      "startAt",
      "endAt",
      "isActive",
      "isFallback",
    ];
    updatable.forEach((k) => {
      if (k in data) banner[k] = data[k];
    });

    // segmentación
    if ("communities" in data) banner.communities = toIdArray(data.communities);
    if ("categories" in data) banner.categories = toIdArray(data.categories);
    if ("businesses" in data) banner.businesses = toIdArray(data.businesses);

    // imágenes (single upload)
    if (req.bannerUpload?.imageUrl) {
      // Si quieres borrar anterior en Cloudinary:
      // try { if (banner.publicId) await cloudinary.uploader.destroy(banner.publicId); } catch {}
      banner.imageUrl = req.bannerUpload.imageUrl;
      banner.publicId = req.bannerUpload.publicId || banner.publicId;
      banner.width = req.bannerUpload.width || banner.width;
      banner.height = req.bannerUpload.height || banner.height;
    }

    // imágenes (multi-variant del processAdImages)
    if (req.body.imageUrl) banner.imageUrl = req.body.imageUrl;
    if (req.body.imageDesktopUrl)
      banner.imageDesktopUrl = req.body.imageDesktopUrl;
    if (req.body.imageTabletUrl)
      banner.imageTabletUrl = req.body.imageTabletUrl;
    if (req.body.imageMobileUrl)
      banner.imageMobileUrl = req.body.imageMobileUrl;
    if ("placement" in data && !("priceCents" in data)) {
      // si cambió el placement y NO enviaron priceCents manual, recalculamos
      banner.priceCents = getPriceCentsForPlacement(banner.placement);
    }
    if ("priceCents" in data) {
      const n = Number(data.priceCents);
      banner.priceCents = Number.isInteger(n) && n > 0 ? n : banner.priceCents;
    }
    if ("currency" in data && typeof data.currency === "string") {
      banner.currency = data.currency.toLowerCase();
    }
    await banner.save();
    return res.json({ msg: "Banner actualizado", banner });
  } catch (err) {
    console.error("❌ updateAdBanner:", err);
    return res.status(500).json({ msg: "Error al actualizar banner" });
  }
};

// ─────────────────────────────────────────────────────────
// Eliminar (admin)
// ─────────────────────────────────────────────────────────
export const deleteAdBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const banner = await AdBanner.findById(id);
    if (!banner) return res.status(404).json({ msg: "No encontrado" });

    const isOwner =
      banner.createdBy?.toString?.() ===
      (req.user?.id || req.user?._id?.toString());
    const isAdmin = req.user?.role === "admin";
    if (!isOwner && !isAdmin)
      return res.status(403).json({ msg: "Sin permisos" });

    // Si quieres borrar el asset principal en Cloudinary:
    // try { if (banner.publicId) await cloudinary.uploader.destroy(banner.publicId); } catch {}

    await banner.deleteOne();
    return res.json({ msg: "Banner eliminado" });
  } catch (err) {
    console.error("❌ deleteAdBanner:", err);
    return res.status(500).json({ msg: "Error al eliminar banner" });
  }
};

// ─────────────────────────────────────────────────────────
// Activos (front): selección por placement (+ segmentación opcional)
// Devuelve { ads: [ ... ] } con serializeAd()
// ─────────────────────────────────────────────────────────
export const getActiveBanners = async (req, res) => {
  try {
    const {
      placement,
      communityId,
      categoryId,
      businessId,
      limit = 1,
      strategy = "weighted",
      includeFallback = "true",
    } = req.query;

    if (!placement) {
      return res.status(400).json({ msg: "placement es requerido" });
    }
    const filter = { ...baseActiveFilter(), placement, status: "active" }; // ⬅️ agregado

    // Base elegibilidad
    // Aseguramos un $and para anexar reglas de segmentación
    if (!filter.$and) filter.$and = [];

    // Segmentación (MVP: comunidad requerida en creación; aquí la usamos si llega)
    const segOr = (field, id) => ({
      $or: [
        { [field]: { $exists: false } },
        { [field]: { $size: 0 } },
        { [field]: { $in: [id] } },
      ],
    });

    if (communityId) filter.$and.push(segOr("communities", communityId));
    if (categoryId) filter.$and.push(segOr("categories", categoryId));
    if (businessId) filter.$and.push(segOr("businesses", businessId));

    const candidates = await AdBanner.find({
      ...filter,
      isFallback: { $ne: true },
    });

    let chosen = [];
    const LIM = Number(limit) || 1;

    if (strategy === "all") {
      chosen = candidates.slice(0, LIM);
    } else if (strategy === "random") {
      chosen = [...candidates].sort(() => Math.random() - 0.5).slice(0, LIM);
    } else {
      // weighted por defecto
      const pool = [...candidates];
      while (chosen.length < LIM && pool.length) {
        const pick = weightedPick(pool);
        if (!pick) break;
        chosen.push(pick);
        const idx = pool.findIndex(
          (x) => x._id.toString() === pick._id.toString()
        );
        if (idx >= 0) pool.splice(idx, 1);
      }
    }

    // Fallbacks si no hubo elegibles vendidos
    if (chosen.length === 0 && includeFallback === "true") {
      const fallbacks = await AdBanner.find({
        placement,
        isActive: true,
        isFallback: true,
        // (opcional) también puedes exigir fechas/límites:
        // ...baseActiveFilter(),
      }).sort({ createdAt: -1 });
      chosen = fallbacks.slice(0, LIM);
    }

    return res.json({ ads: chosen.map(serializeAd) });
  } catch (err) {
    console.error("❌ getActiveBanners:", err);
    return res.status(500).json({ msg: "Error obteniendo anuncios activos" });
  }
};

// ─────────────────────────────────────────────────────────
// Tracking impresiones/clicks
// ─────────────────────────────────────────────────────────
export const trackAdEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.query; // "impression" | "click"

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ msg: "ID inválido" });
    }
    if (!["impression", "click"].includes(type)) {
      return res.status(400).json({ msg: "type inválido" });
    }

    const inc = type === "impression" ? { impressions: 1 } : { clicks: 1 };

    const banner = await AdBanner.findOneAndUpdate(
      {
        _id: id,
        ...(type === "impression"
          ? {
              $or: [
                { maxImpressions: null },
                { $expr: { $lt: ["$impressions", "$maxImpressions"] } },
              ],
            }
          : {
              $or: [
                { maxClicks: null },
                { $expr: { $lt: ["$clicks", "$maxClicks"] } },
              ],
            }),
      },
      { $inc: inc },
      { new: true }
    );

    if (!banner) {
      return res.status(404).json({ msg: "No disponible para tracking" });
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error("❌ trackAdEvent:", err);
    return res.status(500).json({ msg: "Error en tracking" });
  }
};

// Puedes parametrizar días por env
const DEFAULT_DAYS = Number(process.env.AD_BANNER_DEFAULT_DAYS || 30);

// Pricing básico por placement (MVP). Ajusta a tu gusto.
const PLACEMENT_BASE_PRICES = {
  home_top: 14900, // $149.00
  home_bottom: 7900,
  sidebar_right_1: 6900,
  sidebar_right_2: 5900,
  listing_top: 9900,
  listing_inline: 3900,
  community_banner: 5900,
  event_banner: 4900,
  business_banner: 4900,
  custom: 5000,
};

function computePriceCents(banner) {
  const base = PLACEMENT_BASE_PRICES[banner.placement] ?? 5000;
  const days = Math.max(
    1,
    Math.ceil(
      ((banner.endAt || new Date(Date.now() + DEFAULT_DAYS * 86400000)) -
        (banner.startAt || new Date())) /
        86400000
    )
  );
  // Simple: precio proporcional por días (redondeo)
  return Math.round(base * (days / DEFAULT_DAYS));
}

// ─────────────────────────────────────────────────────────
// Admin: poner en revisión (opcional) o aprobar
// ─────────────────────────────────────────────────────────
export const markUnderReview = async (req, res) => {
  const { id } = req.params;
  const banner = await AdBanner.findById(id);
  if (!banner) return res.status(404).json({ msg: "No encontrado" });

  banner.status = "under_review";
  await banner.save();
  return res.json({ msg: "Banner en revisión", banner });
};

export const approveAdBanner = async (req, res) => {
  const { id } = req.params;
  const banner = await AdBanner.findById(id);
  if (!banner) return res.status(404).json({ msg: "No encontrado" });

  banner.status = "approved";
  banner.approvedBy = req.user?._id || req.user?.id;
  banner.approvedAt = new Date();

  // Si no trae fechas, define ventana por defecto al momento de publicar
  // (las fijamos definitivamente cuando pague)
  banner.priceCents = banner.priceCents || computePriceCents(banner);
  await banner.save();
  try {
    const owner = await User.findById(banner.createdBy)
      .select("email name")
      .lean();
    if (owner?.email) {
      await sendAdApprovedUserEmail({ banner, user: owner });
    }
  } catch (e) {
    console.error("⚠️ Email (approved) error:", e.message);
  }
  // 🔔 Notifica al dueño que ya puede pagar

  return res.json({ msg: "Banner aprobado. Listo para pago.", banner });
};

export const rejectAdBanner = async (req, res) => {
  const { id } = req.params;
  const { reason = "" } = req.body || {};
  const banner = await AdBanner.findById(id);
  if (!banner) return res.status(404).json({ msg: "No encontrado" });

  banner.status = "rejected";
  banner.rejectedBy = req.user?._id || req.user?.id;
  banner.rejectedReason = reason;
  banner.isActive = false;
  await banner.save();

  return res.json({ msg: "Banner rechazado", banner });
};

// ─────────────────────────────────────────────────────────
// Owner (o admin): crear sesión de pago Stripe
// ─────────────────────────────────────────────────────────
// src/controllers/adBanner.controller.js
export const createAdCheckout = async (req, res) => {
  try {
    const { id } = req.params;
    const banner = await AdBanner.findById(id);
    if (!banner) return res.status(404).json({ msg: "Banner no encontrado" });

    const isOwner =
      banner.createdBy?.toString?.() ===
      (req.user?.id || req.user?._id?.toString());
    const isAdmin = req.user?.role === "admin";
    if (!isOwner && !isAdmin)
      return res.status(403).json({ msg: "Sin permisos" });

    if (!["approved", "awaiting_payment"].includes(banner.status)) {
      return res
        .status(400)
        .json({ msg: "El banner no está aprobado para pago" });
    }

    const amount = Number(banner.priceCents || 0);
    const currency = (banner.currency || "usd").toLowerCase();
    if (!Number.isInteger(amount) || amount <= 0) {
      return res.status(400).json({ msg: "Monto inválido para checkout" });
    }

    const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
    const success_url = buildUrl(FRONTEND_URL, "/dashboard/mis-banners", {
      checkout: "success",
      bannerId: banner._id.toString(),
    });
    const cancel_url = buildUrl(FRONTEND_URL, "/dashboard/mis-banners", {
      checkout: "cancel",
      bannerId: banner._id.toString(),
    });

    const img =
      banner.imageUrl ||
      banner.imageDesktopUrl ||
      banner.imageTabletUrl ||
      banner.imageMobileUrl ||
      undefined;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url,
      cancel_url,
      client_reference_id: banner._id.toString(),
      metadata: {
        bannerId: banner._id.toString(),
        placement: banner.placement || "",
        months: "1",
      },
      line_items: [
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
      ],
    });

    if (banner.status !== "awaiting_payment") {
      banner.status = "awaiting_payment";
      await banner.save();
    }

    return res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error("❌ createAdCheckout:", err);
    return res
      .status(400)
      .json({ msg: err.message || "Error creando checkout" });
  }
};

export const myAdBanners = async (req, res) => {
  try {
    const banners = await AdBanner.find({ createdBy: req.user._id }).sort({
      createdAt: -1,
    });
    return res.json({ banners });
  } catch (err) {
    console.error("❌ myAdBanners:", err);
    return res.status(500).json({ msg: "Error listando mis banners" });
  }
};
/**
 * GET /api/ads/my-banners
 * Devuelve SOLO los banners del usuario autenticado (aunque sea admin).
 */
export const listMyAdBanners = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ msg: "No autenticado" });

    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit || "20", 10), 1),
      50
    );
    const skip = (page - 1) * limit;

    // 🔒 Forzamos filtro por propietario SIEMPRE, sin importar si es admin
    const filter = {
      createdBy: userId,
      archived: { $ne: true },
    };

    const [banners, total] = await Promise.all([
      AdBanner.find(filter)
        .select(
          "_id title placement status imageUrl impressions clicks startAt endAt createdAt updatedAt priceCents currency"
        )
        .sort({ updatedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AdBanner.countDocuments(filter),
    ]);

    return res.json({
      banners,
      page,
      pages: Math.ceil(total / limit),
      total,
    });
  } catch (err) {
    console.error("❌ listMyAdBanners:", err);
    return res.status(500).json({ msg: "Error listando banners" });
  }
};

/**
 * GET /api/admin/ads/banners
 * Listado global (moderación). SOLO admins. Con filtros opcionales.
 */
export const adminListAdBanners = async (req, res) => {
  try {
    // Este endpoint debe estar protegido por un middleware adminOnly.
    const isAdmin = req.user?.role === "admin";
    if (!isAdmin) return res.status(403).json({ msg: "Solo admins" });

    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit || "20", 10), 1),
      100
    );
    const skip = (page - 1) * limit;

    // Filtros opcionales: status, createdBy, placement
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.createdBy) filter.createdBy = req.query.createdBy;
    if (req.query.placement) filter.placement = req.query.placement;
    if (req.query.q) {
      filter.title = { $regex: req.query.q, $options: "i" };
    }

    const [banners, total] = await Promise.all([
      AdBanner.find(filter)
        .select(
          "_id title placement status imageUrl impressions clicks startAt endAt createdAt updatedAt priceCents currency createdBy"
        )
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AdBanner.countDocuments(filter),
    ]);

    return res.json({
      banners,
      page,
      pages: Math.ceil(total / limit),
      total,
    });
  } catch (err) {
    console.error("❌ adminListAdBanners:", err);
    return res.status(500).json({ msg: "Error listando banners (admin)" });
  }
};
