import Comment from "../models/comment.model.js";
import mongoose from "mongoose";

// Crear comentario
export const createComment = async (req, res) => {
  try {
    const { content, targetType, targetId } = req.body;

    if (!["business", "event"].includes(targetType)) {
      return res.status(400).json({ error: "Tipo de destino inválido." });
    }

    const comment = await Comment.create({
      content,
      targetType,
      targetId,
      author: req.user._id,
    });

    res.status(201).json(comment);
  } catch (error) {
    console.error("Error creando comentario:", error);
    res.status(500).json({ error: "Error al crear comentario." });
  }
};

// Listar comentarios de un recurso
export const getComments = async (req, res) => {
  try {
    const { targetType, targetId } = req.params;

    if (!["business", "event"].includes(targetType)) {
      return res.status(400).json({ error: "Tipo de destino inválido." });
    }

    const comments = await Comment.find({
      targetType,
      targetId,
    })
      .sort({ createdAt: -1 })
      .populate("author", "name profileImage");

    res.json(comments);
  } catch (error) {
    console.error("Error obteniendo comentarios:", error);
    res.status(500).json({ error: "Error al obtener comentarios." });
  }
};

// Eliminar comentario
export const deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({ error: "Comentario no encontrado." });
    }

    if (comment.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "No autorizado." });
    }

    await comment.deleteOne();
    res.json({ message: "Comentario eliminado." });
  } catch (error) {
    console.error("Error eliminando comentario:", error);
    res.status(500).json({ error: "Error al eliminar comentario." });
  }
};
