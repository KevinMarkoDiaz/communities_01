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
  getBusinessesByCommunity, // ✅ Import nuevo
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

// Crear negocio
router.post(
  "/",
  authMiddleware,
  hasRole("admin", "business_owner"),
  uploaderMiddleware,
  imageProcessor,
  parseDataField,
  createBusiness
);

// Obtener todos los negocios
router.get("/", getAllBusinesses);

// ✅ Nueva ruta: Obtener negocios por comunidad
router.get("/community/:communityId", getBusinessesByCommunity);

// Obtener negocios propios
router.get("/mine", authMiddleware, getMyBusinesses);

// Obtener promociones de un negocio
router.get("/:id/promotions", getPromotionsByBusiness);

// Obtener negocio por ID
router.get("/:id", getBusinessById);

// Actualizar negocio
router.put(
  "/:id",
  authMiddleware,
  hasRole("admin", "business_owner"),
  uploaderMiddleware,
  imageProcessor,
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

// Eliminar negocio
router.delete(
  "/:id",
  authMiddleware,
  hasRole("admin", "business_owner"),
  deleteBusiness
);

// Buscar negocios
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

// Like negocio
router.put("/:id/like", authMiddleware, toggleLikeBusiness);

export default router;
