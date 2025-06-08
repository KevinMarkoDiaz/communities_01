import express from "express";
import morgan from "morgan";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import communityRoutes from "./routes/community.routes.js";
import businessRoutes from "./routes/business.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import eventRoutes from "./routes/event.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import stripeRoutes from "./routes/stripe.routes.js";
import cookieParser from "cookie-parser";
import cors from "cors";

import { rawBodyMiddleware } from "./middlewares/rawBodyMiddleware.js";

const app = express();

app.use(morgan("dev"));
app.use(cookieParser());

app.use(
  cors({
    origin: "http://localhost:5173", // ✅ Cambiar por tu dominio de producción
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
app.use("/api", communityRoutes);
app.use("/api", businessRoutes);
app.use("/api", categoryRoutes);
app.use("/api", eventRoutes);
app.use("/api", uploadRoutes);

export default app;
