import { Router } from "express";
import {
  createPromotion,
  deletePromotion,
  updatePromotion,
  getMyPromotions,
  getPromotions,
} from "../controllers/promotion.controller.js";

import { authMiddleware } from "../middlewares/validateToken.js";
import { hasRole } from "../middlewares/hasRole.js";
import {
  uploaderMiddleware,
  imageProcessor,
} from "../middlewares/imageUpload.middleware.js";

import { parseDataField } from "../middlewares/parseDataField.js";
import { addPromotionMetaFields } from "../middlewares/addPromotionMetaFields.js";
// import { validateBody } from "../middlewares/validator.middleware.js";
// import { promotionSchema } from "../schemas/promotion.schema.js";

const router = Router();

// 📥 Obtener todas las promociones (público, con filtros opcionales)
router.get("/promotions", getPromotions);

// ➕ Crear una promoción (admin o business_owner)
router.post(
  "/promotions",
  authMiddleware,
  hasRole("admin", "business_owner"),
  uploaderMiddleware, // 1) multer
  parseDataField, // 2) fusiona req.body.data primero
  imageProcessor, // 3) sube imágenes y coloca URLs en req.body
  addPromotionMetaFields, // 4) agrega campos meta (createdBy, etc.)
  // validateBody(promotionSchema), // 5) (opcional) valida inputs del cliente
  createPromotion // 6) controlador
);

// 📥 Obtener promociones del usuario autenticado
router.get("/promotions/mine", authMiddleware, getMyPromotions);

// 🔁 Actualizar promoción
router.put(
  "/promotions/:id",
  authMiddleware,
  hasRole("admin", "business_owner"),
  uploaderMiddleware, // 1) multer
  parseDataField, // 2) primero fusiona data
  imageProcessor, // 3) luego procesa imágenes
  addPromotionMetaFields,
  // validateBody(promotionSchema.partial()), // opcional
  updatePromotion
);

// ❌ Eliminar promoción
router.delete(
  "/promotions/:id",
  authMiddleware,
  hasRole("admin", "business_owner"),
  deletePromotion
);

export default router;
