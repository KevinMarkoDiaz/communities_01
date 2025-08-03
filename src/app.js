import express from "express";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import cors from "cors";
import passport from "passport";
import dotenv from "dotenv";
dotenv.config();

import "./config/passport.js"; // Tu estrategia Google

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

const app = express();

// Logs
app.use(morgan("dev"));

// Cookies
app.use(cookieParser());

// // 🌐 CORS esto no funciona para local
const allowedOrigins = [
  "http://localhost:5173",
  "https://communidades.com",
  "https://www.communidades.com",
  "https://dev.communidades.com",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS: " + origin));
      }
    },
    credentials: true,
  })
);

// esto funciona para local
// app.use(
//   cors({
//     origin: "http://localhost:5173",
//     credentials: true,
//   })
// );

// Passport
app.use(passport.initialize());

// Stripe Webhook
app.use((req, res, next) => {
  if (req.originalUrl === "/api/stripe/webhook") {
    next();
  } else {
    express.json()(req, res, next);
  }
});

// 🚀 Rutas API
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/stripe", stripeRoutes);
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

// Rutas Follow
app.use("/api/follow", followRoutes);
app.use("/api/users", followRoutes); // Para GET /users/me/following
app.use("/api/ratings", ratingRoutes);

// ✅ Rutas Mensajería
app.use("/api/conversations", conversationRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/comments", commentRoutes);

app.use("/api/user-promos", userPromoRoutes);

export default app;
