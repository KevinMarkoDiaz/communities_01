// controllers/stripeController.js
import Stripe from "stripe";
import dotenv from "dotenv";
import User from "../models/user.model.js";
import { syncUserPremiumStatus } from "../utils/syncUserPremiumStatus.js";

dotenv.config();

const {
  STRIPE_SECRET_KEY,
  STRIPE_PREMIUM_PRICE_ID,
  STRIPE_WEBHOOK_SECRET,
  FRONTEND_URL,
} = process.env;

if (
  !STRIPE_SECRET_KEY ||
  !STRIPE_PREMIUM_PRICE_ID ||
  !STRIPE_WEBHOOK_SECRET ||
  !FRONTEND_URL
) {
  throw new Error("🚨 Falta configurar variables de entorno para Stripe");
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

/**
 * Crear una sesión de pago con Stripe Checkout
 */
export const createCheckoutSession = async (req, res) => {
  try {
    const user = req.user;
    if (!user || !user.email) {
      return res.status(400).json({ message: "Usuario inválido" });
    }

    const cleanFrontendUrl = FRONTEND_URL.endsWith("/")
      ? FRONTEND_URL.slice(0, -1)
      : FRONTEND_URL;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [
        {
          price: STRIPE_PREMIUM_PRICE_ID,
          quantity: 1,
        },
      ],
      customer_email: user.email,
      metadata: {
        userId: user._id.toString(),
      },
      success_url: `${cleanFrontendUrl}/suscripcion-exitosa`,
      cancel_url: `${cleanFrontendUrl}/suscripcion-cancelada`,
    });

    res.status(200).json({ url: session.url });
  } catch (error) {
    console.error("❌ Error creando sesión Stripe:", error);
    res.status(500).json({ message: "Error al iniciar sesión de pago" });
  }
};

/**
 * Webhook de Stripe para manejar eventos automáticos
 */
export const stripeWebhookHandler = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Firma inválida del webhook:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const data = event.data.object;

  switch (event.type) {
    case "checkout.session.completed":
      try {
        const userId = data.metadata.userId;
        const user = await User.findById(userId);
        if (user) {
          user.isPremium = true;
          user.subscriptionId = data.subscription;
          await user.save();
          await syncUserPremiumStatus(user._id, true);
        }
      } catch (err) {
        console.error("⚠️ Error actualizando usuario:", err);
      }
      break;

    case "customer.subscription.deleted":
      try {
        const user = await User.findOne({ subscriptionId: data.id });
        if (user) {
          user.isPremium = false;
          user.subscriptionId = null;
          await user.save();
          await syncUserPremiumStatus(user._id, false);
          console.log(`🛑 Premium cancelado para: ${user.email}`);
        }
      } catch (err) {
        console.error("⚠️ Error al manejar subscription.deleted:", err);
      }
      break;

    default:
      console.log(`🔔 Evento no manejado: ${event.type}`);
  }

  res.status(200).json({ received: true });
};
