import { Router } from "express";
import {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
} from "../controllers/category.controller.js";

import { authMiddleware } from "../middlewares/validateToken.js";
import { hasRole } from "../middlewares/hasRole.js";
import { validateBody } from "../middlewares/validator.middleware.js";

import {
  categoryCreateSchema,
  categoryUpdateSchema,
} from "../schemas/category.schema.js";

import {
  singleProfileImageUpload, // Multer: sube 1 archivo (profileImage)
  handleProfileImage, // Cloudinary: convierte archivo -> URL en req.body.profileImage
} from "../middlewares/imageUpload.middleware.js";

import { parseDataField } from "../middlewares/parseDataField.js";
import { addCategoryCreatorFields } from "../middlewares/addCategoryCreatorFields.js";

const router = Router();

/**
 * 🚦 Orden estable (igual que eventos/negocios):
 * auth → role → upload → parseDataField → handleProfileImage → addCreator → validate → controller
 */

// Crear categoría (admin)
router.post(
  "/categories",
  authMiddleware,
  hasRole("admin"),
  singleProfileImageUpload, // 1) procesa multipart/form-data (opcional)
  parseDataField, // 2) fusiona req.body.data si vino como string JSON
  handleProfileImage, // 3) sube imagen y setea req.body.profileImage (URL)
  addCategoryCreatorFields, // 4) inyecta createdBy*, y si falta icon usa profileImage
  validateBody(categoryCreateSchema), // 5) valida SOLO inputs del cliente
  createCategory // 6) crea
);

// Listar categorías (público)
router.get("/categories", getAllCategories);

// Obtener categoría por ID (público)
router.get("/categories/:id", getCategoryById);

// Actualizar categoría (admin)
router.put(
  "/categories/:id",
  authMiddleware,
  hasRole("admin"),
  singleProfileImageUpload, // 1) archivo opcional
  parseDataField, // 2) soporta body.data
  handleProfileImage, // 3) sube imagen si vino archivo
  validateBody(categoryUpdateSchema), // 4) valida actualización
  updateCategory // 5) actualiza
);

// Eliminar categoría (admin)
router.delete(
  "/categories/:id",
  authMiddleware,
  hasRole("admin"),
  deleteCategory
);

export default router;
