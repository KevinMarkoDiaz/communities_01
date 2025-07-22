import bcrypt from "bcryptjs";
import User from "../models/user.model.js";
import { createAccessToken } from "../libs/jwt.js";
import { setAuthCookie } from "../utils/setAuthCookie.js";

/**
 * Registro de usuario
 */
export const registerUser = async (req, res) => {
  const { name, email, password, role, community, profileImage } = req.body;

  try {
    const existingUser = await User.findOne({ email });
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

    const userData = {
      name,
      email,
      password: hashedPassword,
      role,
      profileImage,
      isVerified: false,
    };

    if (community?.trim()) {
      userData.community = community;
    }

    const newUser = new User(userData);
    await newUser.save();

    const payload = { user: { id: newUser._id, role: newUser.role } };
    let token;
    try {
      token = await createAccessToken(payload);
    } catch (err) {
      console.error("❌ Error al crear token:", err);
      return res.status(500).json({ msg: "Error al generar token" });
    }
    setAuthCookie(res, token);

    return res.status(201).json({
      msg: "Usuario creado",
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        profileImage: newUser.profileImage,
        isVerified: newUser.isVerified,
        community: newUser.community,
        title: newUser.title,
        description: newUser.description,
        location: newUser.location,
        country: newUser.country,
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
 * Login de usuario
 */
export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: "Correo o contraseña incorrectos" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: "Correo o contraseña incorrectos" });
    }

    const payload = { user: { id: user._id, role: user.role } };
    let token;
    try {
      token = await createAccessToken(payload);
    } catch (err) {
      console.error("❌ Error al crear token:", err);
      return res.status(500).json({ msg: "Error al generar token" });
    }
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
    return res
      .status(500)
      .json({
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
