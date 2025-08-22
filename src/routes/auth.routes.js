// src/routes/auth.routes.js
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

import { parseDataField } from "../middlewares/parseDataField.js";

import { updateUser } from "../controllers/user.controller.js";
import { createAccessToken } from "../libs/jwt.js";
import { setAuthCookie } from "../utils/setAuthCookie.js";

const router = Router();

const FRONTEND_URL = process.env.FRONTEND_URL || "https://communidades.com";

/* ───────────────────────────────
   Auth local (email/clave)
   ─────────────────────────────── */

router.post("/register", validateBody(userSchema), registerUser);
router.post("/login", validateBody(loginSchema), loginUser);
router.post("/logout", logoutUser);

router.get("/profile", authMiddleware, getUserProfile);
router.get("/me", authMiddleware, getCurrentUser);

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
  singleProfileImageUpload,
  parseDataField,
  handleProfileImage,
  validateBody(userUpdateSchema),
  updateUser
);

/* ───────────────────────────────
   Autenticación con Google (OAuth)
   ─────────────────────────────── */

router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get("/google/callback", (req, res, next) => {
  passport.authenticate(
    "google",
    {
      session: false,
      failureRedirect: `${FRONTEND_URL}/login?error=oauth_failed`,
    },
    async (err, user) => {
      if (err || !user) {
        console.error("OAuth Google error:", err);
        return res.redirect(`${FRONTEND_URL}/login?error=oauth_failed`);
      }

      try {
        const payload = { user: { id: user._id, role: user.role } };
        const token = await createAccessToken(payload);
        setAuthCookie(res, token);

        const origin = FRONTEND_URL;
        return res.send(`
          <!doctype html>
          <html>
            <head><meta charset="utf-8" /><title>Autenticación correcta</title></head>
            <body>
              <script>
                try {
                  if (window.opener && window.opener !== window) {
                    window.opener.postMessage({ type: "oauth:success" }, "${origin}");
                  }
                } catch (e) {}
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

router.get("/google/failure", (req, res) => {
  const origin = FRONTEND_URL;
  res.send(`
    <!doctype html>
    <html>
      <head><meta charset="utf-8" /><title>Error en autenticación</title></head>
      <body>
        <script>
          try {
            if (window.opener && window.opener !== window) {
              window.opener.postMessage({ type: "oauth:failure" }, "${origin}");
            }
          } catch (e) {}
          window.close();
        </script>
        <p>Ocurrió un error al iniciar sesión con Google.</p>
      </body>
    </html>
  `);
});

export default router;
