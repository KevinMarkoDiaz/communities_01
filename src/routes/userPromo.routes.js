import { Router } from "express";
import {
  claimPromotion,
  redeemPromotionCode,
  getMyClaimedPromos,
} from "../controllers/userPromo.controller.js";
import { authMiddleware } from "../middlewares/validateToken.js";
import { hasRole } from "../middlewares/hasRole.js";

const router = Router();

// ✅ Redención por parte del negocio (¡debe ir antes que /:promotionId!)
router.post(
  "/redeem",
  authMiddleware,
  hasRole("admin", "business_owner"),
  redeemPromotionCode
);

// 👤 El usuario guarda una promoción
router.post("/:promotionId", authMiddleware, claimPromotion);

// 👤 Obtener las promos que el usuario guardó
router.get("/", authMiddleware, getMyClaimedPromos);

export default router;
