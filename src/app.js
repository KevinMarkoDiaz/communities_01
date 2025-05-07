import express from "express";
import morgan from "morgan";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import communityRoutes from "./routes/community.routes.js";
import businessRoutes from "./routes/business.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import eventRoutes from "./routes/event.routes.js";

import cookieParser from 'cookie-parser';

const app = express();

app.use(morgan('dev'));
app.use(cookieParser());
app.use(express.json());

app.use("/api", authRoutes);
app.use("/api", userRoutes);
app.use("/api", communityRoutes);
app.use("/api", businessRoutes);
app.use("/api", categoryRoutes);
app.use("/api", eventRoutes);

export default app;