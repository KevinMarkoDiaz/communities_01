import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/user.model.js";
import dotenv from "dotenv";

dotenv.config();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.BACKEND_URL}/api/auth/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Buscar usuario existente por googleId
        let user = await User.findOne({ googleId: profile.id });

        if (!user) {
          // Si no existe con googleId, buscar por email
          const email = profile.emails?.[0]?.value;

          if (!email) {
            return done(
              new Error("El perfil de Google no contiene email."),
              null
            );
          }

          user = await User.findOne({ email });

          if (user) {
            // Si ya existe por email, asignar googleId
            user.googleId = profile.id;
            // Opcional: actualizar datos si quieres mantenerlos al día
            user.name = profile.displayName || user.name;
            user.profileImage = profile.photos?.[0]?.value || user.profileImage;
            user.isVerified = true;
            await user.save();
          } else {
            // Si no existe, crear usuario nuevo
            user = new User({
              googleId: profile.id,
              name: profile.displayName || "Sin Nombre",
              email: email,
              profileImage: profile.photos?.[0]?.value || "",
              isVerified: true,
              role: "user",
            });
            await user.save();
          }
        } else {
          // Actualizar datos si cambian
          user.name = profile.displayName || user.name;
          user.profileImage = profile.photos?.[0]?.value || user.profileImage;
          user.isVerified = true;
          await user.save();
        }

        return done(null, user);
      } catch (err) {
        console.error("Error en estrategia Google:", err);
        return done(err, null);
      }
    }
  )
);

// Serializa usuario a la sesión
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserializa usuario de la sesión
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});
