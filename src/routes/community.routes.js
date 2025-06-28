import { Router } from "express";
import {
  createCommunity,
  getAllCommunities,
  getCommunityById,
  updateCommunity,
  deleteCommunity,
  getMyCommunities,
  getCommunityBySlug,
} from "../controllers/community.controller.js";

import { authMiddleware } from "../middlewares/validateToken.js";
import { hasRole } from "../middlewares/hasRole.js";
import { validateWith } from "../middlewares/validateWith.js";
import {
  communitySchema,
  communityUpdateSchema,
} from "../schemas/community.schema.js";

import {
  uploadCommunityImages,
  processCommunityImages,
} from "../middlewares/imageUpload.middleware.js"; // Asegurate que sea la ruta correcta

import { parseDataField } from "../middlewares/parseDataField.js";
import { getPromotionsByCommunity } from "../controllers/promotion.controller.js";

const router = Router();

/**
 * Crear comunidad (solo admin o business_owner)
 */
router.post(
  "/communities",
  authMiddleware,
  hasRole("admin", "business_owner"),
  uploadCommunityImages, // 🟡 archivos en req.files
  parseDataField, // 🟠 parsea req.body.data si aplica
  processCommunityImages, // 🔵 sube a Cloudinary, setea req.body.flagImage
  validateWith(communitySchema), // 🟢 aquí ya debe estar flagImage como string
  createCommunity
);

/**
 * Obtener todas las comunidades (público)
 */
router.get("/communities", getAllCommunities);

/**
 * Obtener comunidades del usuario autenticado (admin o business_owner)
 */
router.get(
  "/communities/mine",
  authMiddleware,
  hasRole("admin", "business_owner"),
  getMyCommunities
);

router.get("/community/:id/promotions", getPromotionsByCommunity);

router.get("/communities/slug/:slug", getCommunityBySlug);

/**
 * Obtener comunidad por ID (público)
 */
router.get("/communities/:id", getCommunityById);

/**
 * Actualizar comunidad (solo owner o admin)
 */
router.put(
  "/communities/:id",
  authMiddleware,
  hasRole("admin", "business_owner"),
  uploadCommunityImages, // 🟡 1. Subida de imágenes (flagImage, bannerImage)
  parseDataField, // 🟠 2. Parsear `req.body.data` si viene en string
  processCommunityImages, // 🔵 3. Subida a Cloudinary y limpieza (si aplica)
  updateCommunity // ✅ 5. Controlador principal
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
