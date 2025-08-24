// controllers/emailVerify.controller.js
import crypto from "crypto";
import mongoose from "mongoose";
import User from "../models/user.model.js";
import {
  createEmailVerificationToken,
  buildVerificationLink,
} from "../utils/emailVerification.js";
import { sendVerificationEmail } from "../services/authMailer.service.js"; // ✅ mailer con branding

// ⬇️ O si ya tienes el servicio con las plantillas pro:

const FRONTEND_URL = process.env.FRONTEND_URL || "https://communidades.com";

export const verifyEmail = async (req, res) => {
  try {
    const { token, uid } = req.query;
    if (!token || !uid) return res.status(400).send("Link inválido.");

    // Validar ObjectId antes de golpear la base
    if (!mongoose.Types.ObjectId.isValid(String(uid))) {
      return res.status(400).send("Link inválido.");
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(String(token))
      .digest("hex");

    const now = new Date();

    const user = await User.findOne({
      _id: uid,
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpires: { $gt: now },
    });

    if (!user) {
      // Puede ser token usado/expirado o link manipulado
      return res.status(400).send("Token inválido o expirado.");
    }

    user.isVerified = true;
    user.emailVerificationTokenHash = null;
    user.emailVerificationExpires = null;
    await user.save();

    return res.redirect(`${FRONTEND_URL}login?verified=1`);
  } catch (err) {
    console.error("verifyEmail error:", err);
    return res.status(500).send("Error del servidor");
  }
};

export const resendVerification = async (req, res) => {
  try {
    // Permite email por body o (opcional) tomar del usuario autenticado
    let email = (req.body?.email || req.user?.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ msg: "Email requerido" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ msg: "Usuario no encontrado" });

    if (user.isVerified) {
      return res.status(200).json({ msg: "Tu correo ya está verificado" });
    }

    const now = new Date();

    // Rate‑limit básico: si ya tiene un token vigente por >5 min, no reenviar
    const fiveMinFromNow = new Date(now.getTime() + 5 * 60 * 1000);
    if (
      user.emailVerificationExpires &&
      user.emailVerificationExpires > fiveMinFromNow
    ) {
      return res
        .status(429)
        .json({ msg: "Ya te enviamos un correo, intenta en unos minutos." });
    }

    // Generar nuevo token
    const { token, tokenHash, expires } = createEmailVerificationToken();
    user.emailVerificationTokenHash = tokenHash;
    user.emailVerificationExpires = expires;
    await user.save();

    const link = buildVerificationLink({ uid: user._id, token });

    // ⬇️ Usa el mailer con branding profesional (recomendado)
    try {
      await sendVerificationEmail({ user, link });
    } catch (mailErr) {
      console.error(
        "✉️ Error enviando verificación:",
        mailErr?.message || mailErr
      );
      // Aún así respondemos OK para no filtrar info sensible de entrega
    }

    return res.json({ msg: "Te enviamos un nuevo correo de verificación" });
  } catch (err) {
    console.error("resendVerification error:", err);
    return res.status(500).json({ msg: "Error del servidor" });
  }
};
