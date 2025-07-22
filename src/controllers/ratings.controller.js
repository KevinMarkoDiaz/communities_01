import mongoose from "mongoose";
import Rating from "../models/rating.model.js";
import { ratingSchema } from "../schemas/rating.schema.js";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * Crear o actualizar una calificación (upsert)
 */
export const upsertRating = async (req, res) => {
  try {
    const validated = ratingSchema.parse(req.body);

    if (!isValidObjectId(validated.targetId)) {
      return res.status(400).json({ message: "ID de objetivo inválido" });
    }

    const rating = await Rating.findOneAndUpdate(
      {
        author: req.user._id,
        targetType: validated.targetType,
        targetId: validated.targetId,
      },
      { value: validated.value },
      { new: true, upsert: true }
    );

    res.status(200).json({ message: "Rating registrado", data: rating });
  } catch (error) {
    console.error("Error al crear o actualizar rating:", error);
    const errMsg = error.errors || error.message || "Error inesperado";
    res
      .status(400)
      .json({ message: "Error al registrar rating", error: errMsg });
  }
};

/**
 * Obtener el promedio de calificación para un target
 */
export const getAverageRating = async (req, res) => {
  const { targetType, targetId } = req.params;

  if (!targetType || !targetId || !isValidObjectId(targetId)) {
    return res.status(400).json({ message: "Parámetros inválidos" });
  }

  try {
    const result = await Rating.aggregate([
      {
        $match: {
          targetType,
          targetId: new mongoose.Types.ObjectId(targetId),
        },
      },
      {
        $group: {
          _id: null,
          avg: { $avg: "$value" },
          count: { $sum: 1 },
        },
      },
    ]);

    if (result.length === 0) {
      return res.json({ avg: 0, count: 0 });
    }

    res.json({ avg: result[0].avg, count: result[0].count });
  } catch (error) {
    console.error("Error al obtener promedio de rating:", error);
    res.status(500).json({
      message: "Error interno al calcular promedio",
      error: error.message,
    });
  }
};

/**
 * Obtener todas las calificaciones de un target
 */
export const getRatings = async (req, res) => {
  const { targetType, targetId } = req.params;

  if (!targetType || !targetId || !isValidObjectId(targetId)) {
    return res.status(400).json({ message: "Parámetros inválidos" });
  }

  try {
    const ratings = await Rating.find({
      targetType,
      targetId,
    }).populate("author", "name profileImage");

    res.json({ ratings });
  } catch (error) {
    console.error("Error al obtener ratings:", error);
    res.status(500).json({ message: "Error interno al obtener ratings" });
  }
};
