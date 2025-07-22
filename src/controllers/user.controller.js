import mongoose from "mongoose";
import User from "../models/user.model.js";
import { validationResult } from "express-validator";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * Obtener todos los usuarios (admin)
 */
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.status(200).json(users);
  } catch (error) {
    console.error("Error en getAllUsers:", error);
    res.status(500).json({ message: "Error del servidor al obtener usuarios" });
  }
};

/**
 * Obtener usuario por ID (con relaciones)
 */
export const getUserById = async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return res.status(400).json({ message: "ID de usuario inválido" });
  }

  try {
    const user = await User.findById(id)
      .select("-password")
      .populate("community")
      .populate("communities")
      .populate("businesses")
      .populate("events")
      .populate("categories");

    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error("Error en getUserById:", error);
    res.status(500).json({ message: "Error del servidor al obtener usuario" });
  }
};

/**
 * Actualizar perfil de usuario (propietario o admin)
 */
export const updateUser = async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return res.status(400).json({ message: "ID inválido" });
  }

  // Validación express-validator (si estás usando)
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res
      .status(400)
      .json({ message: "Datos inválidos", errors: errors.array() });
  }

  if (req.user.id !== id && req.user.role !== "admin") {
    return res
      .status(403)
      .json({ message: "No autorizado para editar este perfil" });
  }

  try {
    const user = await User.findById(id);
    if (!user)
      return res.status(404).json({ message: "Usuario no encontrado" });

    const {
      name,
      lastName,
      title,
      description,
      profileImage,
      location,
      country,
      community,
    } = req.body;

    // Solo campos permitidos
    if (name) user.name = name;
    if (lastName) user.lastName = lastName;
    if (title) user.title = title;
    if (description) user.description = description;
    if (profileImage) user.profileImage = profileImage;
    if (location) user.location = location;
    if (country) user.country = country;
    if (community) user.community = community;

    user.updatedAt = Date.now();
    const updatedUser = await user.save();

    res.status(200).json({
      message: "Usuario actualizado",
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        lastName: updatedUser.lastName,
        email: updatedUser.email,
        title: updatedUser.title,
        description: updatedUser.description,
        location: updatedUser.location,
        country: updatedUser.country,
        profileImage: updatedUser.profileImage,
        role: updatedUser.role,
        community: updatedUser.community,
      },
    });
  } catch (error) {
    console.error("Error en updateUser:", error);
    res
      .status(500)
      .json({ message: "Error del servidor al actualizar usuario" });
  }
};

/**
 * Eliminar usuario (admin)
 */
export const deleteUser = async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return res.status(400).json({ message: "ID inválido" });
  }

  if (req.user.role !== "admin") {
    return res
      .status(403)
      .json({ message: "Solo un admin puede eliminar usuarios" });
  }

  try {
    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    res.status(200).json({ message: "Usuario eliminado correctamente" });
  } catch (error) {
    console.error("Error en deleteUser:", error);
    res.status(500).json({ message: "Error del servidor al eliminar usuario" });
  }
};

/**
 * Buscar usuarios por nombre
 */
export const buscarUsuariosPorNombre = async (req, res) => {
  const { name } = req.query;

  if (!name || name.trim().length < 2) {
    return res
      .status(400)
      .json({
        message: "El nombre de búsqueda debe tener al menos 2 caracteres",
      });
  }

  try {
    const regex = new RegExp(name.trim(), "i");
    const users = await User.find({ name: regex }).select(
      "name email profileImage"
    );

    res.json({ users });
  } catch (error) {
    console.error("Error en buscarUsuariosPorNombre:", error);
    res.status(500).json({ message: "Error al buscar usuarios" });
  }
};
