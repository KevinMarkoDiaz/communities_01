import { Router } from "express";
import {
  createCommunity,
  getAllCommunities,
  getCommunityById,
  updateCommunity,
  deleteCommunity,
} from "../controllers/community.controller.js";

import { authMiddleware } from '../middlewares/validateToken.js';
import { hasRole } from "../middlewares/hasRole.js"; 

const router = Router();

// Crear comunidad (solo admin o business_owner)
router.post("/communities", authMiddleware, hasRole('admin', 'business_owner'), createCommunity);

// Obtener todas las comunidades
router.get("/communities", getAllCommunities);

// Obtener comunidad por ID
router.get("/communities/:id", getCommunityById);

// Actualizar comunidad (requiere autenticación y permisos)
router.put("/communities/:id", authMiddleware, hasRole('admin', 'business_owner'), updateCommunity);

// Eliminar comunidad
router.delete("/communities/:id", authMiddleware, hasRole('admin', 'business_owner'), deleteCommunity);

export default router;
