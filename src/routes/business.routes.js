// routes/business.routes.js
import { Router } from "express";
import {
  createBusiness,
  getAllBusinesses,
  getBusinessById,
  updateBusiness,
  deleteBusiness,
  getMyBusinesses,
  getPromotionsByBusiness,
  toggleLikeBusiness,
  getBusinessesByCommunity,
  getBusinessesForMapByCommunity, // ✅ Ruta final usada para el mapa
} from "../controllers/business.controller.js";

import Business from "../models/business.model.js"; // ✅ NECESARIO para /search

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

// Helper pre-parser (igual lógica que en PUT) para usar antes de validateBody
const preparseForValidation = (req, res, next) => {
  try {
    const parseIfString = (field) => {
      if (typeof req.body[field] === "string") {
        try {
          req.body[field] = JSON.parse(req.body[field]);
        } catch (err) {
          console.warn(`⚠️ No se pudo parsear ${field}:`, err.message);
          // Mantén el campo como string o pásalo a undefined si prefieres
          // req.body[field] = undefined;
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
      "existingImages", // 👈 parsea, PERO NO LO MUEVAS
    ].forEach(parseIfString);

    if (typeof req.body.isVerified === "string") {
      req.body.isVerified = req.body.isVerified === "true";
    }
    if (typeof req.body.isDeliveryOnly === "string") {
      req.body.isDeliveryOnly = req.body.isDeliveryOnly === "true";
    }

    // ❌ ELIMINADO:
    // if (req.body.existingImages && !req.body.images) { ... }
    // NO promover existingImages a images

    next();
  } catch (e) {
    console.error("🛑 Error al preparsear campos:", e);
    res.status(400).json({ msg: "Error al preparar datos para validación" });
  }
};

// ✅ Rutas específicas primero
router.get("/map/:communityId", nocache, getBusinessesForMapByCommunity);
router.get("/community/:communityId", getBusinessesByCommunity);

// Obtener todos los negocios (con paginación)
router.get("/", getAllBusinesses);

// Crear negocio
router.post(
  "/",
  authMiddleware,
  hasRole("admin", "business_owner", "user"),
  uploaderMiddleware,
  imageProcessor,
  parseDataField,
  preparseForValidation, // ✅ normaliza antes de validar
  validateBody(businessSchema), // ✅ valida POST
  createBusiness
);

// Obtener negocios propios
router.get("/mine", authMiddleware, getMyBusinesses);

// Obtener promociones de un negocio
router.get("/:id/promotions", getPromotionsByBusiness);

// Buscar negocios (autenticado)
router.get("/search", authMiddleware, async (req, res) => {
  const q = req.query.q;

  if (!q || q.length < 2) {
    return res
      .status(400)
      .json({ msg: "Se requiere una búsqueda de al menos 2 caracteres" });
  }

  try {
    const resultados = await Business.find({
      name: { $regex: q, $options: "i" },
    })
      .limit(10)
      .select("name _id");

    res.status(200).json(resultados);
  } catch (error) {
    console.error("Error en búsqueda de negocios:", error);
    res.status(500).json({ msg: "Error al buscar negocios" });
  }
});

// Obtener negocio por ID
router.get("/:id", getBusinessById);

// Actualizar negocio
router.put(
  "/:id",
  authMiddleware,
  hasRole("admin", "business_owner"),
  uploaderMiddleware,
  debugMultipart, // ← opcional, solo para depurar
  parseDataField, // ← igual que POST
  imageProcessor, // ← sube y deja URLs en body
  preparseForValidation,
  validateBody(updateBusinessSchema),
  updateBusiness
);

// Eliminar negocio
router.delete(
  "/:id",
  authMiddleware,
  hasRole("admin", "business_owner"),
  deleteBusiness
);

// Like negocio
router.put("/:id/like", authMiddleware, toggleLikeBusiness);

export default router;
