import { Router } from "express";
import {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory
} from "../controllers/category.controller.js";

import { authMiddleware } from '../middlewares/validateToken.js';
import { hasRole } from "../middlewares/hasRole.js";

const router = Router();

// Crear una categoría nueva (solo admin)
router.post("/categories", authMiddleware, hasRole('admin'), createCategory);

// Obtener todas las categorías (público)
router.get("/categories", getAllCategories);

// Obtener una categoría por ID (público)
router.get("/categories/:id", getCategoryById);

// Actualizar una categoría (solo admin)
router.put("/categories/:id", authMiddleware, hasRole('admin'), updateCategory);

// Eliminar una categoría (solo admin)
router.delete("/categories/:id", authMiddleware, hasRole('admin'), deleteCategory);

export default router;
