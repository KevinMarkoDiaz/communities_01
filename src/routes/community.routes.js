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

const router = Router();

// Crear comunidad (solo admin o business_owner)
router.post(
  "/communities",
  authMiddleware,
  hasRole("admin", "business_owner"),
  createCommunity
);

// Obtener todas las comunidades (público)
router.get("/communities", getAllCommunities);


router.get(
  "/communities/mine",
  authMiddleware,
  hasRole("admin", "business_owner"),
  getMyCommunities
);


// Obtener comunidad por ID (público)
router.get("/communities/:id", getCommunityById);

// Actualizar comunidad (solo owner o admin)
router.put(
  "/communities/:id",
  authMiddleware,
  hasRole("admin", "business_owner"),
  updateCommunity
);

// Eliminar comunidad (solo owner o admin)
router.delete(
  "/communities/:id",
  authMiddleware,
  hasRole("admin", "business_owner"),
  deleteCommunity
);

export default router;
