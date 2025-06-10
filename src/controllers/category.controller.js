import { validationResult } from "express-validator";
import Category from "../models/category.model.js";
import userModel from "../models/user.model.js";

/**
 * Crear una nueva categoría.
 * Solo pueden hacerlo usuarios autenticados con rol adecuado.
 */
export const createCategory = async (req, res) => {
  try {
    const data = JSON.parse(req.body.data); // ⬅️ Asegurate que esté así
    const { name, description } = data;

    const user = await userModel.findById(req.user.id);
    if (!user) return res.status(401).json({ msg: "Usuario no encontrado" });

    const category = new Category({
      name,
      description,
      icon: req.body.profileImage || "", // ya viene desde el middleware Cloudinary
      createdBy: user._id,
      createdByName: user.name,
      createdByRole: user.role,
    });

    await category.save();
    return res.status(201).json({ msg: "Categoría creada", category });
  } catch (error) {
    console.error("❌ Error en createCategory:", error);
    return res.status(500).json({ msg: "Error interno", error: error.message });
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
    console.error(error);
    res.status(500).json({ msg: "Error al obtener las categorías." });
  }
};

/**
 * Obtener una categoría por ID.
 */
export const getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id).populate(
      "createdBy",
      "name email"
    );
    if (!category) {
      return res.status(404).json({ msg: "Categoría no encontrada." });
    }
    res.status(200).json({ category });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al obtener la categoría." });
  }
};

/**
 * Actualizar una categoría.
 * Solo el creador o un admin puede hacerlo.
 */
export const updateCategory = async (req, res) => {
  const errors = validationResult(req); // ⚠️ omití esto si ya usás Zod
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, icon, description } = req.body;

  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ msg: "Categoría no encontrada." });
    }

    // Validar permisos
    const esCreador = category.createdBy.toString() === req.user.id;
    const esAdmin = req.user.role === "admin";
    if (!esCreador && !esAdmin) {
      return res
        .status(403)
        .json({ msg: "No tienes permisos para actualizar esta categoría." });
    }

    // ❌ Bloquear edición de campos protegidos
    if (
      req.body.createdBy ||
      req.body.createdByName ||
      req.body.createdByRole
    ) {
      return res.status(400).json({
        msg: "No se pueden modificar los datos de creación de la categoría.",
      });
    }

    // ✅ Actualizar solo campos permitidos
    if (name) category.name = name;
    if (icon) category.icon = icon;
    if (description) category.description = description;

    await category.save();

    res.status(200).json({
      msg: "Categoría actualizada correctamente.",
      category,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al actualizar la categoría." });
  }
};

/**
 * Eliminar una categoría.
 * Solo el creador o un admin puede hacerlo.
 */
export const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ msg: "Categoría no encontrada." });
    }

    if (
      category.createdBy.toString() !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({ msg: "No tienes permisos para eliminar esta categoría." });
    }

    await category.deleteOne();

    res.status(200).json({ msg: "Categoría eliminada correctamente." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al eliminar la categoría." });
  }
};
