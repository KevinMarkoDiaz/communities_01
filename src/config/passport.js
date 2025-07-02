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
      callbackURL: `${process.env.BACKEND_URL}/auth/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Buscar usuario existente por googleId
        let user = await User.findOne({ googleId: profile.id });

        // Si no existe, crearlo
        if (!user) {
          user = new User({
            googleId: profile.id,
            name: profile.displayName,
            email: profile.emails?.[0]?.value, // Puede no venir
            profileImage: profile.photos?.[0]?.value,
            isVerified: true, // Opcional: marcar como verificado si llega de Google
            role: "user",
          });
          await user.save();
        } else {
          // Actualizar datos si cambian (por ejemplo nombre o imagen)
          user.name = profile.displayName;
          if (profile.emails?.[0]?.value) user.email = profile.emails[0].value;
          if (profile.photos?.[0]?.value)
            user.profileImage = profile.photos[0].value;
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
