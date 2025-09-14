// routes/business.routes.js
import { Router } from "express";
import {
  createBusiness,
  getAllBusinesses,
  getBusinessByIdOrSlug, // ✅ NUEVO nombre
  updateBusiness,
  deleteBusiness,
  getMyBusinesses,
  getPromotionsByBusiness,
  toggleLikeBusiness,
  getBusinessesByCommunity,
  getBusinessesForMapByCommunity,
} from "../controllers/business.controller.js";

import Business from "../models/business.model.js";

import { authMiddleware } from "../middlewares/validateToken.js";
import { hasRole } from "../middlewares/hasRole.js";
import { validateBody } from "../middlewares/validateBody.js";
import { updateBusinessSchema } from "../schemas/business-update.schema.js";
import { businessSchema } from "../schemas/business.schema.js";
import {
  imageProcessor,
  uploaderMiddleware,
} from "../middlewares/imageUpload.middleware.js";
import { parseDataField } from "../middlewares/parseDataField.js";
import { debugMultipart } from "../middlewares/debugMultipart.middleware.js";
import nocache from "../middlewares/nocache.js";

const router = Router();

const preparseForValidation = (req, res, next) => {
  try {
    const parseIfString = (field) => {
      if (typeof req.body[field] === "string") {
        try {
          req.body[field] = JSON.parse(req.body[field]);
        } catch {
          /* noop */
        }
      }
    };
    [
      "categories",
      "location",
      "contact",
      "openingHours",
      "tags",
      "serviceAreaZips",
      "existingImages",
    ].forEach(parseIfString);
    if (typeof req.body.isVerified === "string")
      req.body.isVerified = req.body.isVerified === "true";
    if (typeof req.body.isDeliveryOnly === "string")
      req.body.isDeliveryOnly = req.body.isDeliveryOnly === "true";
    next();
  } catch (e) {
    console.error("🛑 Error al preparsear campos:", e);
    res.status(400).json({ msg: "Error al preparar datos para validación" });
  }
};

// Geo/map primero
router.get("/map/:communityId", nocache, getBusinessesForMapByCommunity);
router.get("/community/:communityId", getBusinessesByCommunity);

// Listado
router.get("/", getAllBusinesses);

// Crear
router.post(
  "/",
  authMiddleware,
  hasRole("admin", "business_owner", "user"),
  uploaderMiddleware,
  imageProcessor,
  parseDataField,
  preparseForValidation,
  validateBody(businessSchema),
  createBusiness
);

// Míos
router.get("/mine", authMiddleware, getMyBusinesses);

// Promos por negocio (id o slug)
router.get("/:idOrSlug/promotions", getPromotionsByBusiness);

// Detalle por id o slug
router.get("/:idOrSlug", getBusinessByIdOrSlug);

// Actualizar por id o slug
router.put(
  "/:idOrSlug",
  authMiddleware,
  hasRole("admin", "business_owner"),
  uploaderMiddleware,
  debugMultipart,
  parseDataField,
  imageProcessor,
  preparseForValidation,
  validateBody(updateBusinessSchema),
  updateBusiness
);

// Eliminar por id o slug
router.delete(
  "/:idOrSlug",
  authMiddleware,
  hasRole("admin", "business_owner"),
  deleteBusiness
);

// Like por id o slug
router.put("/:idOrSlug/like", authMiddleware, toggleLikeBusiness);

export default router;
