// src/config/passport.js
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import dotenv from "dotenv";
import User from "../models/user.model.js";
import { sendWelcomeEmail } from "../services/authMailer.service.js";

dotenv.config();

/**
 * Flags
 * - Si usas sesiones de Passport en alguna parte, setea USE_PASSPORT_SESSION="true"
 */
const USE_PASSPORT_SESSION =
  String(process.env.USE_PASSPORT_SESSION || "false") === "true";

/**
 * Configura estrategias de Passport (Google, etc.)
 */
export function initPassport() {
  // Evita registrar dos veces la estrategia si el archivo se importa más de una vez
  if (passport._strategies && passport._strategies.google) {
    return passport;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${process.env.BACKEND_URL}/api/auth/google/callback`,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          let isNewUser = false;

          // 1) Buscar por googleId
          let user = await User.findOne({ googleId: profile.id });

          // 2) Si no existe, buscar por email
          if (!user) {
            const email = profile.emails?.[0]?.value;
            if (!email) {
              return done(
                new Error("El perfil de Google no contiene email."),
                null
              );
            }

            user = await User.findOne({ email });

            if (user) {
              // Enlazar cuenta existente con Google
              user.googleId = profile.id;
            } else {
              // Crear usuario nuevo
              user = new User({
                googleId: profile.id,
                name: profile.displayName || "Sin Nombre",
                email,
                profileImage: profile.photos?.[0]?.value || "",
                isVerified: true, // verificado por Google
                role: "user",
                loginProvider: "google",
                welcomeEmailSent: false,
              });
              isNewUser = true;
            }
          }

          // 3) Refrescar datos básicos
          user.name = profile.displayName || user.name;
          user.profileImage = profile.photos?.[0]?.value || user.profileImage;
          user.isVerified = true;
          if (!user.loginProvider) user.loginProvider = "google";
          await user.save();

          // 4) Enviar welcome SOLO si es nuevo y no se envió antes
          if (isNewUser && !user.welcomeEmailSent) {
            try {
              await sendWelcomeEmail({ user });
              user.welcomeEmailSent = true;
              await user.save();
            } catch (e) {
              console.warn("⚠️ No se pudo enviar welcome email:", e.message);
            }
          }

          return done(null, user);
        } catch (err) {
          console.error("Error en estrategia Google:", err);
          return done(err, null);
        }
      }
    )
  );

  if (USE_PASSPORT_SESSION) {
    // Solo si mantienes sesiones de Passport en alguna parte
    passport.serializeUser((user, done) => {
      done(null, user.id);
    });

    passport.deserializeUser(async (id, done) => {
      try {
        const user = await User.findById(id);
        done(null, user);
      } catch (err) {
        done(err, null);
      }
    });
  }

  console.log("[passport] GoogleStrategy registrada"); // 👈 debug útil
  return passport;
}

export default passport;
