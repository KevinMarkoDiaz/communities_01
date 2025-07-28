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
  singleProfileImageUpload, // ⬅️ Multer middleware
  handleProfileImage, // ⬅️ Cloudinary middleware para imagen única
} from "../middlewares/imageUpload.middleware.js";

const router = Router();

// ✅ Crear una categoría nueva con imagen (solo admin)
router.post(
  "/categories",
  authMiddleware,
  hasRole("admin"),
  singleProfileImageUpload,
  handleProfileImage,
  validateBody(categoryCreateSchema), // ⬅️ validación para creación
  createCategory
);

// ✅ Obtener todas las categorías (público)
router.get("/categories", getAllCategories);

// ✅ Obtener una categoría por ID (público)
router.get("/categories/:id", getCategoryById);

// ✅ Actualizar una categoría (solo admin)
router.put(
  "/categories/:id",
  authMiddleware,
  hasRole("admin"),
  singleProfileImageUpload, // ⬅️ primero multer extrae `req.body` y `req.file`
  handleProfileImage, // ⬅️ luego sube imagen y pone la URL en `req.body`
  validateBody(categoryUpdateSchema), // ⬅️ ahora sí `req.body` existe y es validado
  updateCategory
);

// ✅ Eliminar una categoría (solo admin)
router.delete(
  "/categories/:id",
  authMiddleware,
  hasRole("admin"),
  deleteCategory
);

export default router;
