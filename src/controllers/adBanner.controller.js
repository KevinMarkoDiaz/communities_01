// src/controllers/ads.controller.js
import AdBanner from "../models/adBanner.model.js";
import mongoose from "mongoose";
// import { v2 as cloudinary } from "cloudinary"; // ← si quieres borrar assets al eliminar/actualizar

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

    const banner = new AdBanner({
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

    // Base elegibilidad
    const filter = { ...baseActiveFilter(), placement };
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
