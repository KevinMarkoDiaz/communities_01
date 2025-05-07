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

// Crear una categoría nueva (solo admin o business_owner)
router.post("/categories", authMiddleware, hasRole('admin', 'business_owner'), createCategory);

// Obtener todas las categorías
router.get("/categories", getAllCategories);

// Obtener una categoría por ID
router.get("/categories/:id", getCategoryById);

// Actualizar una categoría (solo creador o admin)
router.put("/categories/:id", authMiddleware, hasRole('admin', 'business_owner'), updateCategory);

// Eliminar una categoría (solo creador o admin)
router.delete("/categories/:id", authMiddleware, hasRole('admin', 'business_owner'), deleteCategory);

export default router;
