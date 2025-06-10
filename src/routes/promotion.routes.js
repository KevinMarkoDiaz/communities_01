import { Router } from "express";
import {
  createPromotion,
  getPromotions,
  deletePromotion,
  updatePromotion,
  getMyPromotions,
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
// import { promotionSchema } from "../schemas/promotion.schema.js"; // Si lo tenés

const router = Router();

// 📥 Obtener todas las promociones (público, con filtros opcionales)
router.get("/promotions", getPromotions);

// ➕ Crear una promoción (admin o business_owner)
router.post(
  "/promotions",
  authMiddleware,
  hasRole("admin", "business_owner"),
  uploaderMiddleware,
  imageProcessor,
  parseDataField,
  addPromotionMetaFields,
  // validateBody(promotionSchema), // opcional
  createPromotion
);

// 📥 Obtener promociones del usuario autenticado
router.get(
  "/promotions/mine",
  authMiddleware,
  hasRole("admin", "business_owner"),
  getMyPromotions
);

// 🔁 Actualizar promoción
router.put(
  "/promotions/:id",
  authMiddleware,
  hasRole("admin", "business_owner"),
  uploaderMiddleware,
  imageProcessor,
  parseDataField,
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
