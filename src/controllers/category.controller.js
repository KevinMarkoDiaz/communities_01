// src/controllers/category.controller.js
import Category from "../models/category.model.js";
import User from "../models/user.model.js";
import mongoose from "mongoose";

// 🔧 Validación rápida de ObjectId
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// Utilidad: intenta parsear JSON si es string, si no devuelve tal cual
const parseMaybeJSON = (v, fallback = {}) => {
  if (typeof v !== "string") return v ?? fallback;
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
};

/**
 * Crear una nueva categoría.
 * Compatible con:
 * - multipart/form-data con campo "data" (string JSON)
 * - JSON plano (req.body ya fusionado por parseDataField)
 */
export const createCategory = async (req, res) => {
  try {
    // 1) Normaliza origen de datos
    const body = req.body?.data
      ? parseMaybeJSON(req.body.data, {})
      : req.body || {};

    const name = body.name;
    const description = body.description ?? "";
    // icon puede venir del body.icon (URL directa) o de handleProfileImage (profileImage)
    const icon = body.icon || req.body.icon || req.body.profileImage || "";

    if (!name || String(name).trim() === "") {
      return res.status(400).json({ msg: "El nombre es obligatorio." });
    }

    // 2) Creador: usa lo inyectado por middleware si existe; si no, sácalo de req.user
    let createdBy = body.createdBy || req.body.createdBy;
    let createdByName = body.createdByName || req.body.createdByName;
    let createdByRole = body.createdByRole || req.body.createdByRole;

    if (!createdBy || !createdByName || !createdByRole) {
      const user = await User.findById(req.user.id).select("name role");
      if (!user) return res.status(401).json({ msg: "Usuario no encontrado." });
      createdBy = user._id;
      createdByName = user.name || "Usuario";
      createdByRole = user.role || "user";
    }

    const category = new Category({
      name,
      description,
      icon,
      createdBy,
      createdByName,
      createdByRole,
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
 * Acepta multipart con "data" o JSON plano.
 */
export const updateCategory = async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return res.status(400).json({ msg: "ID de categoría inválido." });
  }

  try {
    const body = req.body?.data
      ? parseMaybeJSON(req.body.data, {})
      : req.body || {};
    const { name, description, createdBy, createdByName, createdByRole } = body;

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ msg: "Categoría no encontrada." });
    }

    const esCreador = category.createdBy.toString() === req.user.id;
    const esAdmin = req.user.role === "admin";

    if (!esCreador && !esAdmin) {
      return res
        .status(403)
        .json({ msg: "No tienes permisos para editar esta categoría." });
    }

    if (createdBy || createdByName || createdByRole) {
      return res
        .status(400)
        .json({ msg: "No se pueden modificar los datos del creador." });
    }

    if (typeof name === "string" && name.trim()) category.name = name.trim();
    if (typeof description === "string") category.description = description;

    // icon puede venir directo o por subida de imagen (profileImage en req.body)
    if (typeof body.icon === "string" && body.icon.trim()) {
      category.icon = body.icon.trim();
    } else if (
      typeof req.body.profileImage === "string" &&
      req.body.profileImage.trim()
    ) {
      category.icon = req.body.profileImage.trim();
    }

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
