import { Router } from "express";
import passport from "passport";

import {
  registerUser,
  loginUser,
  logoutUser,
  getUserProfile,
  getCurrentUser,
} from "../controllers/auth.controller.js";

import { authMiddleware } from "../middlewares/validateToken.js";
import { validateBody } from "../middlewares/validateBody.js";
import { userSchema } from "../schemas/user.schema.js";
import { loginSchema } from "../schemas/login.schema.js";
import { userUpdateSchema } from "../schemas/user-update.schema.js";

import {
  singleProfileImageUpload,
  handleProfileImage,
} from "../middlewares/imageUpload.middleware.js";

import { updateUser } from "../controllers/user.controller.js";

const router = Router();

// 📥 Registro público de usuarios
router.post("/register", validateBody(userSchema), registerUser);

// 🔐 Login con validación Zod
router.post("/login", validateBody(loginSchema), loginUser);

// 🚪 Logout
router.post("/logout", logoutUser);

// 👤 Perfil del usuario autenticado
router.get("/profile", authMiddleware, getUserProfile);

// 🧑 Datos del usuario actual
router.get("/me", authMiddleware, getCurrentUser);

// ✏️ Actualizar perfil
router.put(
  "/profile",
  authMiddleware,
  singleProfileImageUpload,
  handleProfileImage,
  validateBody(userUpdateSchema),
  updateUser
);

//
// ✅ Rutas para autenticación con Google
//

// Iniciar el flujo con Google (redirige a Google)
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// Ruta de retorno (callback) desde Google
router.get(
  "/google/callback",
  passport.authenticate("google", {
    successRedirect: "http://localhost:5173/dashboard", // cambialo por tu URL de frontend
    failureRedirect: "/login",
  })
);

export default router;
