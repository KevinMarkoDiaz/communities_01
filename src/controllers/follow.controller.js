import mongoose from "mongoose";
import Follow from "../models/follow.model.js";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * Crear un seguimiento
 */
export async function createFollow(req, res) {
  const { entityType, entityId } = req.body;

  if (!entityType || !entityId) {
    return res
      .status(400)
      .json({ message: "Los campos entityType y entityId son requeridos" });
  }

  if (!isValidObjectId(entityId)) {
    return res.status(400).json({ message: "entityId inválido" });
  }

  try {
    const follow = await Follow.create({
      user: req.user._id,
      entityType,
      entityId,
    });

    res.status(201).json({ message: "Seguimiento creado", follow });
  } catch (err) {
    if (err.code === 11000) {
      return res
        .status(200)
        .json({ message: "Ya estás siguiendo esta entidad" });
    }

    console.error("Error al crear seguimiento:", err);
    res.status(500).json({ message: "Error interno al crear seguimiento" });
  }
}

/**
 * Eliminar un seguimiento
 */
export async function deleteFollow(req, res) {
  const { entityType, entityId } = req.body;

  if (!entityType || !entityId) {
    return res
      .status(400)
      .json({ message: "Los campos entityType y entityId son requeridos" });
  }

  if (!isValidObjectId(entityId)) {
    return res.status(400).json({ message: "entityId inválido" });
  }

  try {
    const result = await Follow.deleteOne({
      user: req.user._id,
      entityType,
      entityId,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        message: "No se encontró el seguimiento para eliminar",
      });
    }

    res.json({ message: "Seguimiento eliminado correctamente" });
  } catch (err) {
    console.error("Error al eliminar seguimiento:", err);
    res.status(500).json({ message: "Error interno al eliminar seguimiento" });
  }
}

/**
 * Listar seguimientos del usuario autenticado
 */
export async function listFollows(req, res) {
  const { type } = req.query;
  const filter = { user: req.user._id };

  if (type) {
    filter.entityType = type;
  }

  try {
    const follows = await Follow.find(filter).lean();
    res.json({ items: follows });
  } catch (err) {
    console.error("Error al listar seguimientos:", err);
    res
      .status(500)
      .json({ message: "Error interno al cargar la lista de seguimientos" });
  }
}
