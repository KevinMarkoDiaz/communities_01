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
      metadata: {
        userId: user._id.toString(), // ✅ Aquí vinculamos el ID
      },
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
    // 🚨 Aquí usas req.body directamente (Buffer crudo)
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error("❌ Error verificando firma del webhook:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const data = event.data.object;

  switch (event.type) {
    case "checkout.session.completed":
      try {
        const userId = data.metadata.userId;
        console.log("📦 userId recibido en webhook:", userId);

        const user = await User.findById(userId);

        if (user) {
          console.log("✅ Usuario encontrado:", user.email);
          user.isPremium = true;
          user.subscriptionId = data.subscription;
          await user.save();
          console.log("🌟 Usuario marcado como premium");

          console.log("🌟 Usuario actualizado a premium");
        } else {
          console.log("⚠️ No se encontró ningún usuario con ese ID");
        }
      } catch (err) {
        console.error("⚠️ Error actualizando usuario:", err);
      }
      break;

    case "invoice.paid":
      console.log("💰 Factura pagada:", data.id);
      break;

    case "invoice.payment_failed":
      console.warn("❌ Fallo en el pago:", data.id);
      try {
        const user = await User.findOne({ subscriptionId: data.subscription });
        if (user) {
          console.log(`⚠️ Pago fallido para el usuario ${user.email}`);
        }
      } catch (err) {
        console.error("⚠️ Error localizando usuario con pago fallido:", err);
      }
      break;

    case "customer.subscription.updated":
      try {
        const user = await User.findOne({ subscriptionId: data.id });
        if (user) {
          console.log(
            `🔄 Subscripción actualizada para el usuario ${user.email}`
          );
          // Puedes actualizar más campos aquí si usas distintos planes
        }
      } catch (err) {
        console.error("⚠️ Error actualizando subscripción:", err);
      }
      break;

    case "customer.subscription.deleted":
      try {
        const user = await User.findOne({ subscriptionId: data.id });
        if (user) {
          user.isPremium = false;
          user.subscriptionId = null;
          await user.save();
          console.log(
            `👤 Subscripción cancelada, premium desactivado para ${user.email}`
          );
        }
      } catch (err) {
        console.error("⚠️ Error al revertir subscripción:", err);
      }
      break;

    default:
      console.log(`🔔 Evento no manejado: ${event.type}`);
  }

  res.json({ received: true });
};
