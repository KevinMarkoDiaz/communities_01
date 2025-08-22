// routes/community.routes.js
import { Router } from "express";

// Controllers
import {
  createCommunity,
  getAllCommunities,
  getCommunityById,
  updateCommunity,
  deleteCommunity,
  getMyCommunities,
  getCommunityBySlug,
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

const router = Router();

/* ────────────────────────────────────────────────────────────
   Rutas
   ──────────────────────────────────────────────────────────── */

/**
 * Crear comunidad (solo admin o business_owner)
 * - multipart/form-data: imágenes + JSON en "data"
 * - Sube imágenes y coloca URLs en req.body.* antes de validar/crear
 */
router.post(
  "/communities",
  authMiddleware,
  hasRole("admin", "business_owner"),
  uploadCommunityImages, // captura archivos
  parseCommunityData, // parsea data -> req.body
  processCommunityImages, // sube e inyecta URLs a req.body
  validateBody(communitySchema),
  createCommunity
);

/**
 * Listar comunidades (público) con paginación y filtro geográfico opcional
 * ?lat=&lng=&page=&limit=
 */
router.get("/communities", getAllCommunities);

/**
 * Mis comunidades (según rol)
 */
router.get("/communities/mine", authMiddleware, getMyCommunities);

/**
 * Promociones por comunidad (público)
 */
router.get("/community/:id/promotions", getPromotionsByCommunity);

/**
 * Obtener comunidad por slug (público)
 */
router.get("/communities/slug/:slug", getCommunityBySlug);

/**
 * Obtener comunidad por ID (público)
 */
router.get("/communities/:id", getCommunityById);

/**
 * Actualizar comunidad (solo owner o admin)
 * - Acepta multipart/form-data o JSON
 * - Sube nuevas imágenes y actualiza URLs en req.body antes de validar
 */
router.put(
  "/communities/:id",
  authMiddleware,
  hasRole("admin", "business_owner"),
  uploadCommunityImages,
  parseCommunityData,
  processCommunityImages,
  validateBody(communityUpdateSchema),
  updateCommunity
);

/**
 * Eliminar comunidad (solo owner o admin)
 */
router.delete(
  "/communities/:id",
  authMiddleware,
  hasRole("admin", "business_owner"),
  deleteCommunity
);

export default router;
