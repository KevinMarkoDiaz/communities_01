// src/routes/stripe.routes.js
import express from "express";
import { authMiddleware } from "../middlewares/validateToken.js";
import {
  // Premium mensual (ya existente)
  createCheckoutSession,
  // Pago de banners (nuevo)
  createBannerCheckoutSession,
  // Webhook unificado (premium + banners)
  stripeWebhookHandler,
} from "../controllers/stripe.controller.js"; // <- ajusta el nombre si tu archivo se llama distinto

const router = express.Router();

/**
 * 🔐 Checkout de SUSCRIPCIÓN PREMIUM (mode: subscription)
 * body: {}
 * Controller: createCheckoutSession
 */
router.post("/create-checkout-session", authMiddleware, createCheckoutSession);

/**
 * 🔐 Checkout de BANNERS (pago único por 1 mes)
 * body: { bannerId }
 * Controller: createBannerCheckoutSession
 */
router.post(
  "/create-banner-checkout-session",
  authMiddleware,
  createBannerCheckoutSession
);

/**
 * ⚠️ Webhook de Stripe (UNICO)
 * IMPORTANTE: esta ruta debe recibir el body en RAW para verificar la firma.
 * Monta este router ANTES de app.use(express.json()) o excluye esta ruta del json parser global.
 */
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhookHandler
);

export default router;
