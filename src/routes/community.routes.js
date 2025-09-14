// routes/community.routes.js
import { Router } from "express";

// Controllers
import {
  createCommunity,
  getAllCommunities,
  getCommunity, // genérico: resuelve por id o slug
  updateCommunity, // ya soporta idOrSlug internamente
  deleteCommunity, // espera req.params.id (ObjectId) → mapeamos antes
  getMyCommunities,
} from "../controllers/community.controller.js";
import { getPromotionsByCommunity } from "../controllers/promotion.controller.js";

// Middlewares de auth/roles
import { authMiddleware } from "../middlewares/validateToken.js";
import { hasRole } from "../middlewares/hasRole.js";

// Middlewares de imágenes + parseo
import {
  uploadCommunityImages,
  processCommunityImages,
} from "../middlewares/imageUpload.middleware.js";
import { parseCommunityData } from "../middlewares/parseCommunityData.js";

// Validación Zod
import { validateBody } from "../middlewares/validateBody.js";
import {
  communitySchema,
  communityUpdateSchema,
} from "../schemas/community.schema.js";

// Modelo (para resolver slug → _id y redirects)
import Community from "../models/community.model.js";

const router = Router();
const isObjectId = (v) => /^[a-fA-F0-9]{24}$/.test(v);

/* ────────────────────────────────────────────────────────────
   Crear comunidad (solo admin o business_owner)
   multipart/form-data: imágenes + JSON en "data"
   ──────────────────────────────────────────────────────────── */
router.post(
  "/communities",
  authMiddleware,
  hasRole("admin", "business_owner"),
  uploadCommunityImages,
  parseCommunityData,
  processCommunityImages,
  validateBody(communitySchema),
  createCommunity
);

/* ────────────────────────────────────────────────────────────
   Listar comunidades (público)
   ?lat=&lng=&page=&limit=
   ──────────────────────────────────────────────────────────── */
router.get("/communities", getAllCommunities);

/* ────────────────────────────────────────────────────────────
   Mis comunidades (según rol)
   ──────────────────────────────────────────────────────────── */
router.get("/communities/mine", authMiddleware, getMyCommunities);

/* ────────────────────────────────────────────────────────────
   LEGACY: alias slug explícito → redirect 301 a slug plano
   (mantén compatibilidad con enlaces viejos)
   ──────────────────────────────────────────────────────────── */
router.get("/communities/slug/:slug", (req, res) => {
  return res.redirect(301, `/api/communities/${req.params.slug}`);
});

/* ────────────────────────────────────────────────────────────
   Obtener comunidad por :idOrSlug (público)
   - Si viene un ObjectId y existe slug, redirige 301 al slug
   - Si no, despacha al controlador genérico getCommunity
   ──────────────────────────────────────────────────────────── */
router.get(
  "/communities/:idOrSlug",
  async (req, res, next) => {
    const { idOrSlug } = req.params;
    if (isObjectId(idOrSlug)) {
      try {
        const doc = await Community.findById(idOrSlug).select("slug");
        if (doc?.slug) {
          return res.redirect(301, `/api/communities/${doc.slug}`);
        }
      } catch (_) {
        // continúa al controlador genérico si hay error/busca vacío
      }
    }
    return next();
  },
  getCommunity
);

/* ────────────────────────────────────────────────────────────
   Promociones por comunidad (público)
   - Acepta id o slug
   - Mapea a req.params.id (ObjectId) para el controlador existente
   ──────────────────────────────────────────────────────────── */
router.get(
  "/community/:idOrSlug/promotions",
  async (req, _res, next) => {
    const { idOrSlug } = req.params;

    if (isObjectId(idOrSlug)) {
      req.params.id = idOrSlug;
      return next();
    }

    const c = await Community.findOne({ slug: idOrSlug }).select("_id");
    if (!c?._id) {
      // deja que el controlador maneje el not found de forma estándar
      req.params.id = "000000000000000000000000"; // fuerza not found
      return next();
    }
    req.params.id = c._id.toString();
    return next();
  },
  getPromotionsByCommunity
);

/* ────────────────────────────────────────────────────────────
   Actualizar comunidad (solo owner o admin) por :idOrSlug
   - Acepta multipart/form-data o JSON
   - updateCommunity YA soporta idOrSlug internamente
   ──────────────────────────────────────────────────────────── */
router.put(
  "/communities/:idOrSlug",
  authMiddleware,
  hasRole("admin", "business_owner"),
  uploadCommunityImages,
  parseCommunityData,
  processCommunityImages,
  validateBody(communityUpdateSchema),
  updateCommunity
);

/* ────────────────────────────────────────────────────────────
   Eliminar comunidad (solo owner o admin) por :idOrSlug
   - deleteCommunity espera req.params.id (ObjectId)
   - Mapeamos slug → _id antes de llamar al controlador
   ──────────────────────────────────────────────────────────── */
router.delete(
  "/communities/:idOrSlug",
  authMiddleware,
  hasRole("admin", "business_owner"),
  async (req, res, next) => {
    const { idOrSlug } = req.params;
    if (isObjectId(idOrSlug)) {
      req.params.id = idOrSlug;
      return next();
    }
    try {
      const c = await Community.findOne({ slug: idOrSlug }).select("_id");
      if (!c?._id) {
        return res.status(404).json({ msg: "Comunidad no encontrada." });
      }
      req.params.id = c._id.toString();
      return next();
    } catch (e) {
      return res.status(500).json({ msg: "Error al resolver la comunidad." });
    }
  },
  deleteCommunity
);

export default router;
