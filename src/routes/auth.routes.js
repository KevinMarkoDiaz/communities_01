// src/routes/auth.routes.js
import { Router } from "express";
import passport from "passport";

// Asegura que la estrategia de Google esté registrada
// (si ya la importas en otro lugar, puedes omitir esta línea)
import "../config/passport.js";

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

import { parseDataField } from "../middlewares/parseDataField.js";

import { updateUser } from "../controllers/user.controller.js";
import { createAccessToken } from "../libs/jwt.js";
import { setAuthCookie } from "../utils/setAuthCookie.js";

const router = Router();

const FRONTEND_URL = process.env.FRONTEND_URL || "https://app.communidades.com";

/* ───────────────────────────────
   Auth local (email/clave)
   ─────────────────────────────── */

// 📥 Registro público de usuarios
router.post("/register", validateBody(userSchema), registerUser);

// 🔐 Login con validación Zod
router.post("/login", validateBody(loginSchema), loginUser);

// 🚪 Logout (borra cookie JWT)
router.post("/logout", logoutUser);

// 👤 Perfil del usuario autenticado con tu JWT
router.get("/profile", authMiddleware, getUserProfile);

// 🧑 Datos del usuario actual con tu JWT
router.get("/me", authMiddleware, getCurrentUser);

// 🟢 Estado de sesión (Passport). Útil solo si usas sesiones de Passport.
// Si solo usas JWT, normalmente dará `false`.
router.get("/status", (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    res.json({ authenticated: true, user: req.user });
  } else {
    res.json({ authenticated: false });
  }
});

/* ───────────────────────────────
   Actualización de perfil
   ─────────────────────────────── */

router.put(
  "/profile",
  authMiddleware,
  singleProfileImageUpload, // 1) multer: prepara req.file/req.body
  parseDataField, // 2) fusiona req.body.data (si existe) en req.body
  handleProfileImage, // 3) sube imagen, setea req.body.profileImage (URL)
  validateBody(userUpdateSchema), // 4) valida inputs
  updateUser // 5) controlador final
);

/* ───────────────────────────────
   Autenticación con Google (OAuth)
   ─────────────────────────────── */

// Inicia el flujo con Google (popup o redirect)
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// Callback desde Google
router.get("/google/callback", (req, res, next) => {
  passport.authenticate(
    "google",
    {
      session: false, // usamos JWT, no sesiones de Passport
      failureRedirect: `${FRONTEND_URL}/login?error=oauth_failed`,
    },
    async (err, user) => {
      if (err || !user) {
        console.error("OAuth Google error:", err);
        return res.redirect(`${FRONTEND_URL}/login?error=oauth_failed`);
      }

      try {
        // Generar token JWT
        const payload = { user: { id: user._id, role: user.role } };
        const token = await createAccessToken(payload);

        // Setear cookie HttpOnly, Secure, SameSite=None (defínelo dentro de setAuthCookie)
        setAuthCookie(res, token);

        // Si abriste un popup, comunica al frontend y cierra
        // IMPORTANTE: usa el origin exacto del frontend para seguridad
        const origin = FRONTEND_URL;

        return res.send(`
            <!doctype html>
            <html>
              <head>
                <meta charset="utf-8" />
                <title>Autenticación correcta</title>
              </head>
              <body>
                <script>
                  try {
                    if (window.opener && window.opener !== window) {
                      window.opener.postMessage({ type: "oauth:success" }, "${origin}");
                    }
                  } catch (e) { /* noop */ }
                  window.close();
                </script>
                <p>Autenticación correcta. Puedes cerrar esta ventana.</p>
              </body>
            </html>
          `);
      } catch (e) {
        console.error("❌ Error creando token OAuth:", e);
        return res.redirect(`${FRONTEND_URL}/login?error=token_failed`);
      }
    }
  )(req, res, next);
});

// Fallback de error (si usas redirect directo en vez de popup)
router.get("/google/failure", (req, res) => {
  const origin = FRONTEND_URL;
  res.send(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Error en autenticación</title>
      </head>
      <body>
        <script>
          try {
            if (window.opener && window.opener !== window) {
              window.opener.postMessage({ type: "oauth:failure" }, "${origin}");
            }
          } catch (e) { /* noop */ }
          window.close();
        </script>
        <p>Ocurrió un error al iniciar sesión con Google.</p>
      </body>
    </html>
  `);
});

export default router;
