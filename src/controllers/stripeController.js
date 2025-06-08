// controllers/stripeController.js
import Stripe from "stripe";
import dotenv from "dotenv";
import User from "../models/user.model.js";

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

// ✅ Controlador para crear la sesión de checkout
export const createCheckoutSession = async (req, res) => {
  try {
    const user = req.user;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [
        {
          price: process.env.STRIPE_PREMIUM_PRICE_ID,
          quantity: 1,
        },
      ],
      customer_email: user.email,
      success_url: `${process.env.FRONTEND_URL}/suscripcion-exitosa`,
      cancel_url: `${process.env.FRONTEND_URL}/suscripcion-cancelada`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("❌ Error creando sesión Stripe:", error);
    res.status(500).json({ message: "Error creando la sesión de pago" });
  }
};

// ✅ Webhook que maneja eventos enviados por Stripe
export const stripeWebhookHandler = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
  } catch (err) {
    console.error("❌ Error verificando firma del webhook:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const data = event.data.object;

  switch (event.type) {
    case "checkout.session.completed":
      console.log("✅ Checkout completado:", data.id);
      try {
        const user = await User.findOne({ email: data.customer_email });
        if (user) {
          user.role = "premium";
          user.subscriptionId = data.subscription;
          await user.save();
          console.log("🎉 Usuario actualizado a Premium");
        }
      } catch (err) {
        console.error("⚠️ Error actualizando usuario:", err);
      }
      break;

    case "invoice.paid":
      console.log("💸 Factura pagada:", data.id);
      // Podrías guardar el historial de pagos aquí si querés
      break;

    case "invoice.payment_failed":
      console.warn("❌ Fallo en el pago:", data.id);
      try {
        const user = await User.findOne({ subscriptionId: data.subscription });
        if (user) {
          console.log("🔔 Avisar al usuario:", user.email);
        }
      } catch (err) {
        console.error("⚠️ Error localizando usuario con pago fallido:", err);
      }
      break;

    case "customer.subscription.updated":
      console.log("🔄 Subscripción actualizada:", data.id);
      try {
        const user = await User.findOne({ subscriptionId: data.id });
        if (user) {
          // Aquí podés actualizar info adicional si usás distintos planes
          console.log(`📌 Subscripción de ${user.email} fue actualizada.`);
        }
      } catch (err) {
        console.error("⚠️ Error actualizando subscripción:", err);
      }
      break;

    case "customer.subscription.deleted":
      console.log("🚫 Subscripción cancelada:", data.id);
      try {
        const user = await User.findOne({ subscriptionId: data.id });
        if (user) {
          user.role = "user";
          user.subscriptionId = null;
          await user.save();
          console.log("🔄 Usuario volvió a rol básico");
        }
      } catch (err) {
        console.error("⚠️ Error al revertir subscripción:", err);
      }
      break;

    default:
      console.log(`📌 Evento no manejado: ${event.type}`);
  }

  res.json({ received: true });
};
