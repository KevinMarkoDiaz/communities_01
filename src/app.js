import express from "express";
import morgan from "morgan";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import communityRoutes from "./routes/community.routes.js";
import businessRoutes from "./routes/business.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import eventRoutes from "./routes/event.routes.js";
import uploadRoutes from './routes/upload.routes.js';
import cors from "cors";

import cookieParser from 'cookie-parser';

const app = express();

app.use(morgan('dev'));
app.use(cookieParser());
// Habilitar CORS
app.use(cors({
  origin: "http://localhost:5173", // ⚠️ Cambiá esto por tu dominio real en producción
  credentials: true
}));
app.use(express.json());



app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes); // Todas empiezan con /api/users
app.use("/api", communityRoutes);
app.use("/api", businessRoutes);
app.use("/api", categoryRoutes);
app.use("/api", eventRoutes);
app.use('/api', uploadRoutes);
export default app;