import Comment from "../models/comment.model.js";
import mongoose from "mongoose";

// Utilidad: validar tipo de destino permitido
const isValidTargetType = (type) => ["business", "event"].includes(type);

// Utilidad: validar ObjectId
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * Crear comentario
 */
export const createComment = async (req, res) => {
  try {
    const { content, targetType, targetId } = req.body;

    if (!isValidTargetType(targetType)) {
      return res.status(400).json({ error: "Tipo de destino inválido." });
    }

    if (!isValidObjectId(targetId)) {
      return res.status(400).json({ error: "ID de destino inválido." });
    }

    if (!content || content.trim() === "") {
      return res
        .status(400)
        .json({ error: "El contenido no puede estar vacío." });
    }

    const comment = await Comment.create({
      content: content.trim(),
      targetType,
      targetId,
      author: req.user._id,
    });

    res.status(201).json(comment);
  } catch (error) {
    console.error("❌ Error en createComment:", error);
    res.status(500).json({ error: "Error al crear comentario." });
  }
};

/**
 * Listar comentarios por recurso
 */
export const getComments = async (req, res) => {
  try {
    const { targetType, targetId } = req.params;

    if (!isValidTargetType(targetType)) {
      return res.status(400).json({ error: "Tipo de destino inválido." });
    }

    if (!isValidObjectId(targetId)) {
      return res.status(400).json({ error: "ID de destino inválido." });
    }

    const comments = await Comment.find({ targetType, targetId })
      .sort({ createdAt: -1 })
      .populate("author", "name profileImage");

    res.status(200).json(comments);
  } catch (error) {
    console.error("❌ Error en getComments:", error);
    res.status(500).json({ error: "Error al obtener comentarios." });
  }
};

/**
 * Eliminar comentario
 */
export const deleteComment = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "ID de comentario inválido." });
    }

    const comment = await Comment.findById(id);
    if (!comment) {
      return res.status(404).json({ error: "Comentario no encontrado." });
    }

    const esAutor = comment.author.toString() === req.user._id.toString();
    if (!esAutor && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ error: "No tienes permisos para eliminar este comentario." });
    }

    await comment.deleteOne();
    res.status(200).json({ message: "Comentario eliminado correctamente." });
  } catch (error) {
    console.error("❌ Error en deleteComment:", error);
    res.status(500).json({ error: "Error al eliminar comentario." });
  }
};
