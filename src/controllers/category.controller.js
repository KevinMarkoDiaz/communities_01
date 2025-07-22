import { validationResult } from "express-validator";
import Category from "../models/category.model.js";
import User from "../models/user.model.js";
import mongoose from "mongoose";

// 🔧 Validación rápida de ObjectId
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * Crear una nueva categoría.
 */
export const createCategory = async (req, res) => {
  try {
    if (!req.body.data) {
      return res.status(400).json({ msg: "Faltan datos en la solicitud." });
    }

    let data;
    try {
      data = JSON.parse(req.body.data);
    } catch (parseErr) {
      return res.status(400).json({ msg: "Formato JSON inválido en 'data'." });
    }

    const { name, description } = data;

    if (!name) {
      return res.status(400).json({ msg: "El nombre es obligatorio." });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).json({ msg: "Usuario no encontrado." });

    const icon = req.body.profileImage || ""; // Asumimos subida por Cloudinary

    const category = new Category({
      name,
      description,
      icon,
      createdBy: user._id,
      createdByName: user.name,
      createdByRole: user.role,
    });

    await category.save();
    return res.status(201).json({ msg: "Categoría creada", category });
  } catch (error) {
    console.error("❌ Error en createCategory:", error);
    return res.status(500).json({ msg: "Error interno del servidor" });
  }
};

/**
 * Obtener todas las categorías.
 */
export const getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find().populate(
      "createdBy",
      "name email"
    );
    res.status(200).json({ categories });
  } catch (error) {
    console.error("❌ Error en getAllCategories:", error);
    res.status(500).json({ msg: "Error al obtener las categorías." });
  }
};

/**
 * Obtener una categoría por ID.
 */
export const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ msg: "ID de categoría inválido." });
    }

    const category = await Category.findById(id).populate(
      "createdBy",
      "name email"
    );
    if (!category) {
      return res.status(404).json({ msg: "Categoría no encontrada." });
    }

    res.status(200).json({ category });
  } catch (error) {
    console.error("❌ Error en getCategoryById:", error);
    res.status(500).json({ msg: "Error al obtener la categoría." });
  }
};

/**
 * Actualizar una categoría.
 */
export const updateCategory = async (req, res) => {
  const { id } = req.params;
  const { name, icon, description, createdBy, createdByName, createdByRole } =
    req.body;

  if (!isValidObjectId(id)) {
    return res.status(400).json({ msg: "ID de categoría inválido." });
  }

  try {
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ msg: "Categoría no encontrada." });
    }

    const esCreador = category.createdBy.toString() === req.user.id;
    const esAdmin = req.user.role === "admin";
    if (!esCreador && !esAdmin) {
      return res
        .status(403)
        .json({ msg: "No tienes permisos para actualizar esta categoría." });
    }

    if (createdBy || createdByName || createdByRole) {
      return res
        .status(400)
        .json({ msg: "No se pueden modificar los datos del creador." });
    }

    if (name) category.name = name;
    if (icon) category.icon = icon;
    if (description) category.description = description;

    await category.save();

    res
      .status(200)
      .json({ msg: "Categoría actualizada correctamente.", category });
  } catch (error) {
    console.error("❌ Error en updateCategory:", error);
    res.status(500).json({ msg: "Error al actualizar la categoría." });
  }
};

/**
 * Eliminar una categoría.
 */
export const deleteCategory = async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return res.status(400).json({ msg: "ID de categoría inválido." });
  }

  try {
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ msg: "Categoría no encontrada." });
    }

    const esCreador = category.createdBy.toString() === req.user.id;
    const esAdmin = req.user.role === "admin";

    if (!esCreador && !esAdmin) {
      return res
        .status(403)
        .json({ msg: "No tienes permisos para eliminar esta categoría." });
    }

    await category.deleteOne();

    res.status(200).json({ msg: "Categoría eliminada correctamente." });
  } catch (error) {
    console.error("❌ Error en deleteCategory:", error);
    res.status(500).json({ msg: "Error al eliminar la categoría." });
  }
};
