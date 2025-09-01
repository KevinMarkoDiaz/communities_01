// src/controllers/auth.controller.js
import bcrypt from "bcryptjs";
import User from "../models/user.model.js";
import { createAccessToken } from "../libs/jwt.js";
import { setAuthCookie } from "../utils/setAuthCookie.js";
import {
  createEmailVerificationToken,
  buildVerificationLink,
} from "../utils/emailVerification.js";
import { sendVerificationEmail } from "../services/authMailer.service.js"; // <- usa el brandeado

// controllers/auth.controller.js

const SKIP_EMAIL_VERIFICATION =
  String(process.env.SKIP_EMAIL_VERIFICATION).toLowerCase() === "true";

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

    // 🔀 Flujo bifurcado por feature-flag
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
      // ✅ Si saltamos verificación, el usuario queda verificado desde el registro
      isVerified: SKIP_EMAIL_VERIFICATION ? true : false,
      // ✅ Guardar token solo si vamos a usar verificación por correo
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
    setAuthCookie(res, tokenJwt);

    return res.status(201).json({
      msg: SKIP_EMAIL_VERIFICATION
        ? "Usuario creado y verificado."
        : "Usuario creado. Te enviamos un email para verificar tu correo.",
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        isVerified: newUser.isVerified, // true si skip, false si requiere verificación
      },
    });
  } catch (error) {
    console.error("Error en registro:", error);
    return res
      .status(500)
      .json({ msg: "Error del servidor", error: error.message });
  }
};
// export const registerUser = async (req, res) => {
//   const { name, email, password, role, community, profileImage } = req.body;

//   try {
//     const normalizedEmail = String(email).trim().toLowerCase(); // 👈
//     const existingUser = await User.findOne({ email: normalizedEmail }); // 👈
//     if (existingUser) {
//       return res
//         .status(400)
//         .json({ msg: "El correo electrónico ya está registrado" });
//     }
//     if (role === "admin") {
//       return res
//         .status(403)
//         .json({ msg: "No tienes permisos para asignar el rol de admin." });
//     }

//     const hashedPassword = await bcrypt.hash(password, 10);
//     const { token, tokenHash, expires } = createEmailVerificationToken();

//     const userData = {
//       name,
//       email: normalizedEmail, // 👈
//       password: hashedPassword,
//       role,
//       profileImage,
//       isVerified: false,
//       emailVerificationTokenHash: tokenHash,
//       emailVerificationExpires: expires,
//     };
//     if (community?.trim()) userData.community = community;

//     const newUser = await new User(userData).save();
//     try {
//       const link = buildVerificationLink({ uid: newUser._id, token });
//       await sendVerificationEmail({ user: newUser, link });
//     } catch (mailErr) {
//       console.error("✉️ Error enviando verificación:", mailErr);
//     }

//     const payload = { user: { id: newUser._id, role: newUser.role } };
//     const tokenJwt = await createAccessToken(payload);
//     setAuthCookie(res, tokenJwt);

//     return res.status(201).json({
//       msg: "Usuario creado. Te enviamos un email para verificar tu correo.",
//       user: {
//         id: newUser._id,
//         name: newUser.name,
//         email: newUser.email,
//         role: newUser.role,
//         isVerified: newUser.isVerified,
//       },
//     });
//   } catch (error) {
//     console.error("Error en registro:", error);
//     return res
//       .status(500)
//       .json({ msg: "Error del servidor", error: error.message });
//   }
// };

export const loginUser = async (req, res) => {
  const { email, password } = req.body;
  try {
    const normalizedEmail = String(email).trim().toLowerCase(); // 👈
    const user = await User.findOne({ email: normalizedEmail }); // 👈
    if (!user)
      return res.status(400).json({ msg: "Correo o contraseña incorrectos" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ msg: "Correo o contraseña incorrectos" });

    const payload = { user: { id: user._id, role: user.role } };
    const token = await createAccessToken(payload);
    setAuthCookie(res, token);

    return res.status(200).json({
      msg: "Inicio de sesión exitoso",
      token,
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
 * Logout (borra cookie JWT)
 */
export const logoutUser = (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: true,
    sameSite: "None",
    domain: ".communidades.com",
  });

  return res.status(200).json({ message: "Sesión cerrada correctamente" });
};

/**
 * Obtener perfil del usuario autenticado
 */
export const getUserProfile = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ msg: "No autenticado" });
    }

    const user = await User.findById(req.user.id).select("-password");

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
 * Devuelve el usuario actual (atajo para /me)
 */
export const getCurrentUser = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ msg: "No autenticado" });
    }

    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ msg: "Usuario no encontrado" });

    return res.json({ usuario: user });
  } catch (err) {
    console.error("Error al obtener perfil (/me):", err);
    return res
      .status(500)
      .json({ msg: "Error al obtener perfil", error: err.message });
  }
};
