// src/app.js (o index de tu servidor Express)
import express from "express";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import cors from "cors";
import passport from "passport";
import dotenv from "dotenv";
dotenv.config();

import "./config/passport.js"; // Estrategia Google

// Rutas
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import communityRoutes from "./routes/community.routes.js";
import businessRoutes from "./routes/business.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import eventRoutes from "./routes/event.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import stripeRoutes from "./routes/stripe.routes.js";
import searchRoutes from "./routes/search.routes.js";
import promotionRoutes from "./routes/promotion.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import followRoutes from "./routes/follow.routes.js";
import ratingRoutes from "./routes/ratings.routes.js";

import communityViewRoutes from "./routes/communityView.routes.js";
import businessViewRoutes from "./routes/businessView.routes.js";
import eventViewRoutes from "./routes/eventView.routes.js";

// 🚀 Nuevas rutas de Mensajería
import conversationRoutes from "./routes/conversation.routes.js";
import messageRoutes from "./routes/message.routes.js";
import commentRoutes from "./routes/comments.routes.js";

import userPromoRoutes from "./routes/userPromo.routes.js";
import adBannerRoutes from "./routes/adBanner.routes.js";
import { initPassport } from "./config/passport.js";

const app = express();

// Logs
app.use(morgan("dev"));

// Cookies
app.use(cookieParser());

// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// CORS
// (anterior) ❌ Solo web con cookies
// app.use(
//   cors({
//     origin: "http://localhost:5173",
//     credentials: true,
//   })
// );

// (anterior allowlist web) ❌ cookies
// const allowedOrigins = [
//   "http://localhost:5173",
//   "https://communidades.com",
//   "https://www.communidades.com",
//   "https://dev.communidades.com",
// ];
// app.use(
//   cors({
//     origin(origin, cb) {
//       if (!origin || allowedOrigins.includes(origin)) cb(null, true);
//       else cb(new Error("Not allowed by CORS: " + origin));
//     },
//     credentials: true,
//   })
// );

// 🆕 Mobile-friendly CORS (Bearer, sin cookies)
const allowedMobile = [
  "capacitor://localhost",
  // "http://localhost:5173", // ← solo si quieres probar web contra este backend
];

const isLan = (origin) => {
  try {
    const u = new URL(origin);
    const h = u.hostname;
    const is192 = /^192\.168\.\d{1,3}\.\d{1,3}$/.test(h);
    const is10 = /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h);
    const is172 = /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(h);
    return u.protocol === "http:" && (is192 || is10 || is172);
  } catch {
    return false;
  }
};

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true); // apps nativas / curl
      if (allowedMobile.includes(origin) || isLan(origin))
        return cb(null, true);
      return cb(new Error("Not allowed by CORS: " + origin));
    },
    credentials: false, // 🆕 sin cookies en mobile
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"], // 🆕 Authorization
  })
);

initPassport();
// Passport
app.use(passport.initialize());

// ─────────────────────────────────────────────────────────────
// Body parser condicional para Stripe Webhook
// IMPORTANTE: el webhook necesita body RAW. Evitamos aplicar express.json()
// a esa ruta exacta. Luego, dentro de stripe.routes.js, la ruta usa express.raw().
app.use((req, res, next) => {
  // Usa startsWith por si algún día agregas querystring a la ruta
  if (req.originalUrl.startsWith("/api/stripe/webhook")) {
    // no aplicar express.json en esta ruta
    return next();
  }
  // para el resto, aplica JSON
  return express.json()(req, res, next);
});

// ─────────────────────────────────────────────────────────────
// Rutas API
// Stripe primero o después funciona igual porque el parser ya es condicional
app.use("/api/stripe", stripeRoutes);

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);

app.use("/api/busqueda", searchRoutes);
app.use("/api/businesses", businessRoutes);
app.use("/api/events", eventRoutes);

app.use("/api/community-views", communityViewRoutes);
app.use("/api/business-views", businessViewRoutes);
app.use("/api/event-views", eventViewRoutes);
app.use("/api", promotionRoutes);
app.use("/api", communityRoutes);
app.use("/api", categoryRoutes);
app.use("/api", uploadRoutes);
app.use("/api", notificationRoutes);

// Follow / Ratings
app.use("/api/follow", followRoutes);
app.use("/api/users", followRoutes); // GET /users/me/following
app.use("/api/ratings", ratingRoutes);

// Mensajería
app.use("/api/conversations", conversationRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/comments", commentRoutes);

// Promos usuario
app.use("/api/user-promos", userPromoRoutes);

// Ads / Banners
app.use("/api", adBannerRoutes);

// ─────────────────────────────────────────────────────────────
// Salud opcional
app.get("/api/health", (_req, res) =>
  res.json({ ok: true, env: process.env.NODE_ENV || "dev" })
);

// 404 opcional
app.use((req, res) => {
  res.status(404).json({ msg: "Not Found" });
});

export default app;
