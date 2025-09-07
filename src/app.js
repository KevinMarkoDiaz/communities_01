// src/app.js
import express from "express";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import cors from "cors";
import passport from "passport";
import dotenv from "dotenv";
dotenv.config();

import "./config/passport.js"; // Estrategia Google
import { initPassport } from "./config/passport.js";

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

const app = express();

// Logs
app.use(morgan("dev"));

// Cookies (queda por compatibilidad; mobile no usa cookies)
app.use(cookieParser());

/* ─────────────────────────────────────────────────────────────
   CORS
   (anterior) ❌ Solo web con cookies
   ----------------------------------------------------------------
   app.use(
     cors({
       origin: "http://localhost:5173",
       credentials: true,
     })
   );

   (anterior allowlist web) ❌ cookies
   ----------------------------------------------------------------
   const allowedOriginsWeb = [
     "http://localhost:5173",
     "https://communidades.com",
     "https://www.communidades.com",
     "https://dev.communidades.com",
   ];
   app.use(
     cors({
       origin(origin, cb) {
         if (!origin || allowedOriginsWeb.includes(origin)) cb(null, true);
         else cb(new Error("Not allowed by CORS: " + origin));
       },
       credentials: true,
     })
   );
   ───────────────────────────────────────────────────────────── */

/* 🆕 CORS para MOBILE (Bearer en Authorization, sin cookies)
   - Permite WebView de Capacitor: https://localhost (androidScheme "https")
   - Permite capacitor://localhost
   - Permite LAN http://192.168.x.x … (útil para pruebas)
   - Mantengo dominios de producción por si alguna vista los necesita (sin cookies)
*/
const allowedOrigins = new Set([
  "https://localhost", // WebView con androidScheme "https"
  "http://localhost", // por si cambias a http
  "capacitor://localhost", // esquema de Capacitor
  // "http://localhost:5173",       // <- descomenta solo si vas a pegarle desde tu web local a este backend
  "https://communidades.com",
  "https://www.communidades.com",
  "https://dev.communidades.com",
]);

function isLanOrigin(origin) {
  try {
    const u = new URL(origin);
    const { protocol, hostname } = u;
    const isLan =
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);
    return protocol === "http:" && isLan;
  } catch {
    return false;
  }
}

// (opcional) Log para saber qué Origin llega
app.use((req, _res, next) => {
  if (req.headers.origin) console.log("CORS origin:", req.headers.origin);
  next();
});

const corsOptionsDelegate = (req, cb) => {
  const origin = req.header("Origin");
  if (!origin || allowedOrigins.has(origin) || isLanOrigin(origin)) {
    cb(null, {
      origin: true, // refleja el origin permitido
      credentials: false, // MOBILE: sin cookies
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
      exposedHeaders: ["Set-Cookie"],
      optionsSuccessStatus: 204, // evita 500 en preflight
    });
  } else {
    cb(new Error("Not allowed by CORS: " + origin));
  }
};

app.use(cors(corsOptionsDelegate));
// Asegurar que todos los preflight OPTIONS respondan OK
app.options("*", cors(corsOptionsDelegate));

// Passport
initPassport();
app.use(passport.initialize());

// ─────────────────────────────────────────────────────────────
// Body parser condicional para Stripe Webhook
// IMPORTANTE: el webhook necesita body RAW. Evitamos aplicar express.json()
// a esa ruta exacta. Luego, dentro de stripe.routes.js, la ruta usa express.raw().
app.use((req, res, next) => {
  if (req.originalUrl.startsWith("/api/stripe/webhook")) {
    return next(); // no aplicar express.json en esta ruta
  }
  return express.json()(req, res, next);
});

// ─────────────────────────────────────────────────────────────
// Rutas API
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
