import Rating from "../models/rating.model.js";
import mongoose from "mongoose";
import { ratingSchema } from "../schemas/rating.schema.js";

// ✅ Crear o actualizar una calificación
export const upsertRating = async (req, res) => {
  try {
    const validated = ratingSchema.parse(req.body);

    const rating = await Rating.findOneAndUpdate(
      {
        author: req.user._id,
        targetType: validated.targetType,
        targetId: validated.targetId,
      },
      { value: validated.value },
      { new: true, upsert: true }
    );

    res.status(200).json(rating);
  } catch (error) {
    console.error("Error creando rating:", error);
    return res.status(400).json({ error: error.errors || error.message });
  }
};

// ✅ Obtener el promedio de calificación
export const getAverageRating = async (req, res) => {
  const { targetType, targetId } = req.params;

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
    console.error("Error obteniendo promedio:", error);
    res
      .status(500)
      .json({ error: "Error al obtener promedio de calificación" });
  }
};

// ✅ Obtener todas las calificaciones (opcional)
export const getRatings = async (req, res) => {
  const { targetType, targetId } = req.params;

  try {
    const ratings = await Rating.find({
      targetType,
      targetId,
    }).populate("author", "name profileImage");

    res.json(ratings);
  } catch (error) {
    console.error("Error obteniendo ratings:", error);
    res.status(500).json({ error: "Error al obtener ratings" });
  }
};
