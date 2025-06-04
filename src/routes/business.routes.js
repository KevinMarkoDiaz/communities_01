import { Router } from "express";
import {
  createBusiness,
  getAllBusinesses,
  getBusinessById,
  updateBusiness,
  deleteBusiness,
  getMyBusinesses,
} from "../controllers/business.controller.js";

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

const router = Router();

// Crear negocio (solo admin o business_owner)
router.post(
  "/businesses",
  authMiddleware,
  hasRole("admin", "business_owner"),
  uploaderMiddleware,
  imageProcessor,
  parseDataField, // ⬅️ este es el nuevo
  createBusiness
);

// Obtener todos los negocios
router.get("/businesses", getAllBusinesses);

router.get(
  "/businesses/mine",
  authMiddleware,
  hasRole("admin", "business_owner"),
  getMyBusinesses
);
// Obtener negocio por ID
router.get("/businesses/:id", getBusinessById);

// Actualizar negocio (solo owner o admin)
router.put(
  "/businesses/:id",
  authMiddleware,
  hasRole("admin", "business_owner"),
  uploaderMiddleware,
  imageProcessor,
  // ⬇️ Middleware para parsear campos que llegan como string en FormData
  (req, res, next) => {
    try {
      const parseIfString = (field) => {
        if (typeof req.body[field] === "string") {
          try {
            req.body[field] = JSON.parse(req.body[field]);
          } catch (err) {
            console.warn(`⚠️ No se pudo parsear ${field}:`, err.message);
            req.body[field] = undefined;
          }
        }
      };

      ["location", "contact", "openingHours", "tags"].forEach(parseIfString);

      if (typeof req.body.isVerified === "string") {
        req.body.isVerified = req.body.isVerified === "true";
      }

      if (req.body.existingImages && !req.body.images) {
        try {
          req.body.images = JSON.parse(req.body.existingImages);
        } catch (err) {
          console.warn("❗ Error al parsear existingImages:", err.message);
          req.body.images = [];
        }
      }

      next();
    } catch (e) {
      console.error("🛑 Error al preparsear campos:", e);
      res.status(400).json({ msg: "Error al preparar datos para validación" });
    }
  },
  validateBody(updateBusinessSchema),
  updateBusiness
);

// Eliminar negocio (solo owner o admin)
router.delete(
  "/businesses/:id",
  authMiddleware,
  hasRole("admin", "business_owner"),
  deleteBusiness
);

export default router;
