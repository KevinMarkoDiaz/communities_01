import express from "express";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import cors from "cors";
import session from "express-session";
import passport from "passport";
import "./config/passport.js"; // Tu estrategia Google

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
import { rawBodyMiddleware } from "./middlewares/rawBodyMiddleware.js";

const app = express();

app.use(morgan("dev"));
app.use(cookieParser());

app.use(
  session({
    secret: process.env.JWT_SECRET || "comunidades_session_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      sameSite: "lax",
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

const allowedOrigins = [
  "http://localhost:5173",
  "https://communidades.com",
  "https://www.communidades.com",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.use(rawBodyMiddleware);

app.use((req, res, next) => {
  if (req.originalUrl === "/api/stripe/webhook") {
    next();
  } else {
    express.json()(req, res, next);
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/stripe", stripeRoutes);
app.use("/api/busqueda", searchRoutes);
app.use("/api", promotionRoutes);

app.use("/api", communityRoutes);
app.use("/api", businessRoutes);
app.use("/api", categoryRoutes);
app.use("/api", eventRoutes);
app.use("/api", uploadRoutes);

export default app;
