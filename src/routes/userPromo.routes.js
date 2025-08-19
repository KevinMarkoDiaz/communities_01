// src/routes/userPromo.routes.js
import { Router } from "express";
import {
  claimPromotion,
  redeemPromotionCode,
  getMyClaimedPromos,
} from "../controllers/userPromo.controller.js";
import { authMiddleware } from "../middlewares/validateToken.js";
import { hasRole } from "../middlewares/hasRole.js";

const router = Router();

router.post(
  "/redeem",
  authMiddleware,
  hasRole("admin", "business_owner"),
  redeemPromotionCode
);

router.post("/:promotionId", authMiddleware, claimPromotion);

router.get("/", authMiddleware, getMyClaimedPromos);

export default router;
