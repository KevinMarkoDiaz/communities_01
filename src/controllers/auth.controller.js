// src/controllers/auth.controller.js
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken"; // 🆕 necesario para refresh
import User from "../models/user.model.js";
import { createAccessToken } from "../libs/jwt.js";
import { setAuthCookie } from "../utils/setAuthCookie.js";
import {
  createEmailVerificationToken,
  buildVerificationLink,
} from "../utils/emailVerification.js";
import { sendVerificationEmail } from "../services/authMailer.service.js"; // <- usa el brandeado

// Flag para saltar verificación por email (útil en entornos de prueba/dev)
const SKIP_EMAIL_VERIFICATION =
  String(process.env.SKIP_EMAIL_VERIFICATION).toLowerCase() === "true";

/**
 * Registro de usuario
 * - Mantiene tu flujo con verificación opcional por email
 * - Autentica al final y devuelve { token, user }
 * - (Mobile) No setea cookie; la línea queda comentada por si lo quieres para web
 */
export const registerUser = async (req, res) => {
  const { name, email, password, role, community, profileImage } = req.body;

  try {
    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase();
    if (!normalizedEmail || !password || !name) {
      return res.status(400).json({ msg: "Faltan datos obligatorios" });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res
        .status(400)
        .json({ msg: "El correo electrónico ya está registrado" });
    }

    if (role === "admin") {
      return res
        .status(403)
        .json({ msg: "No tienes permisos para asignar el rol de admin." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // 🔀 Flujo bifurcado por feature-flag (verificación por email)
    let token, tokenHash, expires;
    if (!SKIP_EMAIL_VERIFICATION) {
      const t = createEmailVerificationToken();
      token = t.token;
      tokenHash = t.tokenHash;
      expires = t.expires;
    }

    const userData = {
      name,
      email: normalizedEmail,
      password: hashedPassword,
      role,
      profileImage,
      isVerified: SKIP_EMAIL_VERIFICATION ? true : false,
      emailVerificationTokenHash: SKIP_EMAIL_VERIFICATION
        ? undefined
        : tokenHash,
      emailVerificationExpires: SKIP_EMAIL_VERIFICATION ? undefined : expires,
    };

    if (community?.trim()) userData.community = community;

    const newUser = await new User(userData).save();

    // ✉️ Enviar email SÓLO si no se salta la verificación
    if (!SKIP_EMAIL_VERIFICATION) {
      try {
        const link = buildVerificationLink({ uid: newUser._id, token });
        await sendVerificationEmail({ user: newUser, link });
      } catch (mailErr) {
        console.error("✉️ Error enviando verificación:", mailErr);
        // No fallamos el registro por un error de correo
      }
    }

    // 🔐 Autenticar de una vez
    const payload = { user: { id: newUser._id, role: newUser.role } };
    const tokenJwt = await createAccessToken(payload);

    // setAuthCookie(res, tokenJwt);               // ❌ (Mobile) no usar cookie; déjalo si este backend también sirve Web

    return res.status(201).json({
      msg: SKIP_EMAIL_VERIFICATION
        ? "Usuario creado y verificado."
        : "Usuario creado. Te enviamos un email para verificar tu correo.",
      token: tokenJwt, // 🆕 clave para Mobile (Bearer)
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        isVerified: newUser.isVerified,
      },
    });
  } catch (error) {
    console.error("Error en registro:", error);
    return res
      .status(500)
      .json({ msg: "Error del servidor", error: error.message });
  }
};

/**
 * Login (email + password)
 * - Devuelve { token, user }
 * - (Mobile) No setea cookie; la línea queda comentada
 */
export const loginUser = async (req, res) => {
  const { email, password } = req.body;
  try {
    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user)
      return res.status(400).json({ msg: "Correo o contraseña incorrectos" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ msg: "Correo o contraseña incorrectos" });

    const payload = { user: { id: user._id, role: user.role } };
    const token = await createAccessToken(payload);

    // setAuthCookie(res, token); // ❌ (Mobile) no usar cookie; déjalo si este backend también sirve Web

    return res.status(200).json({
      msg: "Inicio de sesión exitoso",
      token, // 🆕 clave para Mobile (Bearer)
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profileImage: user.profileImage,
        isVerified: user.isVerified,
        community: user.community,
        title: user.title,
        description: user.description,
        location: user.location,
        country: user.country,
      },
    });
  } catch (error) {
    console.error("Error en login:", error);
    return res
      .status(500)
      .json({ msg: "Error del servidor", error: error.message });
  }
};

/**
 * Logout
 * - En Mobile no hay cookie que limpiar; respondemos 200.
 * - Dejo clearCookie comentado por si este backend lo usas también para Web.
 */
export const logoutUser = (req, res) => {
  // res.clearCookie("token", {       // ❌ (Mobile) no hay cookie
  //   httpOnly: true,
  //   secure: true,
  //   sameSite: "None",
  //   domain: ".communidades.com",
  // });

  return res.status(200).json({ message: "Sesión cerrada correctamente" });
};

/**
 * Perfil del usuario autenticado (usa req.user seteado por authMiddleware)
 */
export const getUserProfile = async (req, res) => {
  try {
    // Con tu authMiddleware, req.user ya es el documento User
    const userDoc = req.user || null;
    const userId = userDoc?._id || req.user?.id; // compat

    if (!userDoc && !userId) {
      return res.status(401).json({ msg: "No autenticado" });
    }

    const user = userDoc || (await User.findById(userId).select("-password"));

    if (!user) {
      return res.status(404).json({ msg: "Usuario no encontrado" });
    }

    return res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profileImage: user.profileImage,
        isVerified: user.isVerified,
        community: user.community,
        title: user.title,
        description: user.description,
        location: user.location,
        country: user.country,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error al obtener perfil:", error);
    return res.status(500).json({
      msg: "Error al obtener el perfil del usuario",
      error: error.message,
    });
  }
};

/**
 * Obtener usuario actual (atajo para /me)
 */
export const getCurrentUser = async (req, res) => {
  try {
    const userDoc = req.user || null;
    const userId = userDoc?._id || req.user?.id; // compat

    if (!userDoc && !userId) {
      return res.status(401).json({ msg: "No autenticado" });
    }

    const user = userDoc || (await User.findById(userId).select("-password"));
    if (!user) return res.status(404).json({ msg: "Usuario no encontrado" });

    return res.json({ usuario: user });
  } catch (err) {
    console.error("Error al obtener perfil (/me):", err);
    return res
      .status(500)
      .json({ msg: "Error al obtener perfil", error: err.message });
  }
};

/* ─────────────────────────────────────────────────────────────
   🆕 Refresh token (Mobile, Bearer)
   - Lee Authorization: Bearer <token> (no cookies)
   - Si es válido, emite uno nuevo con la misma identidad
   - Mantén expiración corta en access token si quieres usar refresh de verdad
   (este ejemplo re-emite mismo tipo de token; puedes cambiar a flujo Refresh dedicado)
───────────────────────────────────────────────────────────── */
export const refreshToken = async (req, res) => {
  try {
    const h = req.headers.authorization || "";
    const old = h.startsWith("Bearer ") ? h.slice(7) : null;

    if (!old) return res.status(401).json({ error: "No token" });

    const payload = jwt.verify(old, process.env.JWT_SECRET);
    // payload.user = { id, role }
    const user = await User.findById(payload.user.id).select("_id role email");
    if (!user) return res.status(401).json({ error: "User not found" });

    const fresh = await createAccessToken({
      user: { id: user._id, role: user.role },
    });

    // setAuthCookie(res, fresh); // ❌ (Mobile) no cookies

    return res.json({ token: fresh });
  } catch (e) {
    console.error("Refresh error:", e);
    return res.status(401).json({ error: "Invalid token" });
  }
};
