import { Router } from "express";
import {
  createCommunity,
  getAllCommunities,
  getCommunityById,
  updateCommunity,
  deleteCommunity,
  getMyCommunities,
} from "../controllers/community.controller.js";

import { authMiddleware } from "../middlewares/validateToken.js";
import { hasRole } from "../middlewares/hasRole.js";
import { validateWith  } from "../middlewares/validateWith.js";
import { communitySchema, communityUpdateSchema } from "../schemas/community.schema.js";


const router = Router();

/**
 * Crear comunidad (solo admin o business_owner)
 */
router.post(
  "/communities",
  authMiddleware,
  hasRole("admin", "business_owner"),
  validateWith(communitySchema), // ✅ validación con Zod
  createCommunity
);

/**
 * Obtener todas las comunidades (público)
 */
router.get("/communities", getAllCommunities);

/**
 * Obtener comunidades del usuario autenticado (admin o business_owner)
 */
router.get(
  "/communities/mine",
  authMiddleware,
  hasRole("admin", "business_owner"),
  getMyCommunities
);

/**
 * Obtener comunidad por ID (público)
 */
router.get("/communities/:id", getCommunityById);

/**
 * Actualizar comunidad (solo owner o admin)
 */
router.put(
  "/communities/:id",
  authMiddleware,
  hasRole("admin", "business_owner"),
  validateWith(communityUpdateSchema), // ✅ validación parcial para PUT
  updateCommunity
);

/**
 * Eliminar comunidad (solo owner o admin)
 */
router.delete(
  "/communities/:id",
  authMiddleware,
  hasRole("admin", "business_owner"),
  deleteCommunity
);

export default router;
