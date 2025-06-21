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
    const token = await createAccessToken(payload);
    setAuthCookie(res, token);

    res.status(201).json({
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
      },
    });
  } catch (error) {
    console.error("Error en registro:", error);
    res.status(500).send("Error del servidor");
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
    const token = await createAccessToken(payload);
    setAuthCookie(res, token);

    res.status(200).json({
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
      },
    });
  } catch (error) {
    console.error("Error en login:", error);
    res.status(500).send("Error del servidor");
  }
};

/**
 * Logout (borra cookie JWT)
 */
export const logoutUser = (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
  });

  res.status(200).json({ message: "Sesión cerrada correctamente" });
};

/**
 * Obtener perfil del usuario autenticado
 */
export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");

    if (!user) {
      return res.status(404).json({ msg: "Usuario no encontrado" });
    }

    res.status(200).json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      profileImage: user.profileImage,
      isVerified: user.isVerified,
      community: user.community,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (error) {
    console.error("Error al obtener perfil:", error);
    res.status(500).json({ msg: "Error al obtener el perfil del usuario" });
  }
};

/**
 * Devuelve el usuario actual (atajo para /me)
 */
export const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ msg: "Usuario no encontrado" });
    res.json({ usuario: user });
  } catch (err) {
    console.error("Error al obtener perfil (/me):", err);
    res.status(500).json({ msg: "Error al obtener perfil" });
  }
};
