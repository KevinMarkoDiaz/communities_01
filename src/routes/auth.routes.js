// src/routes/auth.routes.js
import { Router } from "express";
import passport from "passport";

import {
  registerUser,
  loginUser,
  logoutUser,
  getUserProfile,
  getCurrentUser,
  refreshToken, // 🆕
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

import {
  resendVerification,
  verifyEmail,
} from "../controllers/emailVerify.controller.js";

// 🆕 State firmado para OAuth mobile (anti-CSRF)
import { signOAuthState, verifyOAuthState } from "../utils/oauthState.js";

const router = Router();

const FRONTEND_URL = process.env.FRONTEND_URL || "https://communidades.com";

// (Opcional) URL de callback móvil si quieres forzarla desde aquí
// Configúrala también en Google Console.
// Ejemplo: https://api-mobile.tu-dominio.com/api/auth/google/callback-mobile
const GOOGLE_MOBILE_CALLBACK_URL =
  process.env.GOOGLE_MOBILE_CALLBACK_URL ||
  "https://api-mobile.tu-dominio.com/api/auth/google/callback-mobile";

/* ───────────────────────────────
   Auth local (email/clave)
   ─────────────────────────────── */

// 🆕 Refresh compatible con Bearer (sin cookies)
router.post("/refresh", refreshToken);

router.post("/register", validateBody(userSchema), registerUser);
router.post("/login", validateBody(loginSchema), loginUser);
router.post("/logout", logoutUser);

router.get("/profile", authMiddleware, getUserProfile);
router.get("/me", authMiddleware, getCurrentUser);

router.get("/status", (req, res) => {
  // Nota: si NO usas sesiones de Passport, isAuthenticated puede no aplicar.
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

/**
 * WEB (histórico)
 * Mantengo tu flujo web. En backend solo-mobile te conviene NO setear cookies.
 * Por eso dejo el setAuthCookie comentado aquí.
 */
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

        // ❌ MOBILE: no usar cookies en este backend
        // setAuthCookie(res, token);

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

/**
 * 🆕 MOBILE: Inicio de OAuth con state firmado y callback móvil.
 * Llama la app: GET /api/auth/google/mobile?redirect=communidades://oauth-callback&returnTo=/home
 * - redirect: deep link a tu app (scheme://host)
 * - returnTo: ruta interna a la que quieres volver dentro de la app
 */
router.get("/google/mobile", (req, res, next) => {
  const redirect = req.query.redirect || "communidades://oauth-callback";
  const returnTo = req.query.returnTo || "/";
  const nonce = Math.random().toString(36).slice(2);

  const state = signOAuthState({ redirect, returnTo, nonce });

  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
    state, // firmado: se validará en el callback
    // Forzar callback móvil (si tu estrategia lo permite aquí)
    callbackURL: GOOGLE_MOBILE_CALLBACK_URL,
  })(req, res, next);
});

/**
 * 🆕 MOBILE: Callback que NO usa cookies.
 * Verifica el state, crea JWT y redirige a tu deep link con el token en el fragment.
 * Ej: communidades://oauth-callback#token=...&returnTo=/home
 */
router.get("/google/callback-mobile", (req, res, next) => {
  passport.authenticate(
    "google",
    {
      session: false,
      failureRedirect: `${FRONTEND_URL}/login?error=oauth_failed`,
      callbackURL: GOOGLE_MOBILE_CALLBACK_URL,
    },
    async (err, user) => {
      if (err || !user) {
        console.error("OAuth Google error (mobile):", err);
        return res.status(401).send("OAuth failed");
      }

      try {
        // 1) Validar STATE
        let redirect = "communidades://oauth-callback";
        let returnTo = "/";
        try {
          const st = verifyOAuthState(req.query.state || "");
          if (st?.redirect) redirect = st.redirect;
          if (st?.returnTo) returnTo = st.returnTo;
        } catch {
          return res.status(400).send("Invalid OAuth state");
        }

        // 2) Emitir JWT (NO COOKIE)
        const payload = { user: { id: user._id, role: user.role } };
        const token = await createAccessToken(payload);

        // 3) Redirigir a la app con token en fragment (evita logs de query)
        const location = `${encodeURI(redirect)}#token=${encodeURIComponent(
          token
        )}&returnTo=${encodeURIComponent(returnTo)}`;

        return res.redirect(location);
      } catch (e) {
        console.error("❌ Error creando token OAuth (mobile):", e);
        return res.status(500).send("token_failed");
      }
    }
  )(req, res, next);
});

router.get("/verify-email", verifyEmail);
router.post("/verify-email/resend", resendVerification);

export default router;
