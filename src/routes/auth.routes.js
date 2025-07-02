import { Router } from "express";
import passport from "passport";

import jwt from "jsonwebtoken";
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

// 🚪 Logout (Passport + tu lógica)

router.post("/logout", logoutUser);

// 👤 Perfil del usuario autenticado con tu JWT
router.get("/profile", authMiddleware, getUserProfile);

// 🧑 Datos del usuario actual con tu JWT
router.get("/me", authMiddleware, getCurrentUser);

// 🟢 Estado de sesión (Passport)
router.get("/status", (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ authenticated: true, user: req.user });
  } else {
    res.json({ authenticated: false });
  }
});

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

// Iniciar flujo con Google
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// Callback desde Google

router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: "/login",
  }),
  (req, res) => {
    // Aquí req.user ya existe gracias a la estrategia
    const token = jwt.sign(
      { id: req.user._id, email: req.user.email, role: req.user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Devuelve un HTML que hace postMessage al opener
    res.send(`
      <html>
        <head>
          <script>
            window.opener.postMessage(${JSON.stringify(token)}, "*");
            window.close();
          </script>
        </head>
        <body>
          <p>Autenticación correcta. Puedes cerrar esta ventana.</p>
        </body>
      </html>
    `);
  }
);

// Fallback de error
router.get("/google/failure", (req, res) => {
  res.send(`
    <html>
      <head>
        <script>
          window.opener.postMessage("failure", "*");
          window.close();
        </script>
      </head>
      <body>
        <p>Ocurrió un error al iniciar sesión con Google.</p>
      </body>
    </html>
  `);
});

export default router;
