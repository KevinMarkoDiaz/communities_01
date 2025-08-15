// src/routes/stripe.routes.js
import express from "express";
import { authMiddleware } from "../middlewares/validateToken.js";

// ⛳️ IMPORTA desde el nombre REAL de tu controller:
//   - Si tu archivo es src/controllers/stripeController.js  -> usa "../controllers/stripeController.js"
//   - Si se llama src/controllers/stripe.controller.js      -> deja como está
import {
  createCheckoutSession, // Suscripción Premium (mode: subscription)
  createBannerCheckoutSession, // Pago de Banners (mode: payment)
  stripeWebhookHandler, // Webhook unificado
} from "../controllers/stripe.controller.js"; // ⬅️ AJUSTA si tu archivo se llama distinto

const router = express.Router();

/**
 * ⚠️ Webhook de Stripe
 * Esta RUTA debe recibir el body en RAW para verificar la firma.
 * No pongas router.use(express.json()) antes de esto.
 * Full path: /api/stripe/webhook
 */
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhookHandler
);

/**
 * A partir de aquí, para endpoints normales usamos JSON parser.
 * (El webhook no se ve afectado porque arriba ya lo tratamos con raw).
 */
router.use(express.json());

/**
 * 🔐 Checkout SUSCRIPCIÓN PREMIUM
 * POST /api/stripe/create-checkout-session
 * body: {}
 */
router.post("/create-checkout-session", authMiddleware, createCheckoutSession);

/**
 * 🔐 Checkout BANNERS (1 mes)
 * POST /api/stripe/create-banner-checkout-session
 * body: { bannerId }
 */
router.post(
  "/create-banner-checkout-session",
  authMiddleware,
  createBannerCheckoutSession
);

export default router;
