import { validationResult } from 'express-validator';
import Category from '../models/category.model.js';

/**
 * Crear una nueva categoría.
 * Solo pueden hacerlo usuarios autenticados (idealmente admins en el futuro).
 */
export const createCategory = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, icon, description } = req.body;

  try {
    // Verificá si ya existe una categoría con ese nombre
    const existing = await Category.findOne({ name });
    if (existing) {
      return res.status(400).json({ msg: 'Ya existe una categoría con ese nombre.' });
    }

    const category = new Category({
      name,
      icon,
      description,
      createdBy: req.user.id // Asociamos al usuario autenticado
    });

    await category.save();

    res.status(201).json({
      msg: 'Categoría creada exitosamente.',
      category
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error al crear la categoría.' });
  }
};

/**
 * Obtener todas las categorías.
 */
export const getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find().populate('createdBy', 'name email');
    res.status(200).json({ categories });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error al obtener las categorías.' });
  }
};

/**
 * Obtener una categoría por ID.
 */
export const getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id).populate('createdBy', 'name email');
    if (!category) {
      return res.status(404).json({ msg: 'Categoría no encontrada.' });
    }
    res.status(200).json({ category });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error al obtener la categoría.' });
  }
};

/**
 * Actualizar una categoría.
 * Solo el creador o un admin puede hacerlo.
 */
export const updateCategory = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, icon, description } = req.body;

  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ msg: 'Categoría no encontrada.' });
    }

    // Validar permisos
    if (category.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'No tienes permisos para actualizar esta categoría.' });
    }

    category.name = name || category.name;
    category.icon = icon || category.icon;
    category.description = description || category.description;

    await category.save();

    res.status(200).json({
      msg: 'Categoría actualizada correctamente.',
      category
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error al actualizar la categoría.' });
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
      return res.status(404).json({ msg: 'Categoría no encontrada.' });
    }

    if (category.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'No tienes permisos para eliminar esta categoría.' });
    }

    await category.deleteOne();

    res.status(200).json({ msg: 'Categoría eliminada correctamente.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error al eliminar la categoría.' });
  }
};
