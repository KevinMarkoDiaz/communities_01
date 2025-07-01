// routes/stripe.routes.js
import express from "express";
import { authMiddleware } from "../middlewares/validateToken.js";
import {
  createCheckoutSession,
  stripeWebhookHandler,
} from "../controllers/stripe.controller.js";

const router = express.Router();

/**
 * 🔐 Ruta protegida para crear una sesión de pago con Stripe
 * Esta ruta la llama el frontend cuando el usuario hace clic en "Suscribirse"
 */
router.post("/create-checkout-session", authMiddleware, createCheckoutSession);

/**
 * ⚠️ Webhook de Stripe para recibir eventos (NO debe tener express.json aplicado)
 * Usa express.raw para permitir a Stripe verificar la firma del payload
 */
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhookHandler
);

export default router;
