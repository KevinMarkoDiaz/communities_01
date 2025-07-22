import mongoose from "mongoose";
import Notification from "../models/Notification.model.js";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * Obtener las notificaciones del usuario autenticado
 */
export const getUserNotifications = async (req, res) => {
  try {
    const userId = req.user.id;

    const notifications = await Notification.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({ notifications });
  } catch (error) {
    console.error("❌ Error al obtener notificaciones:", error);
    res
      .status(500)
      .json({ message: "Error interno al obtener notificaciones" });
  }
};

/**
 * Marcar una notificación como leída
 */
export const markNotificationRead = async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return res.status(400).json({ message: "ID de notificación inválido" });
  }

  try {
    const notification = await Notification.findById(id);

    if (!notification) {
      return res.status(404).json({ message: "Notificación no encontrada" });
    }

    if (notification.user.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ message: "No tienes permisos sobre esta notificación" });
    }

    if (!notification.read) {
      notification.read = true;
      await notification.save();
    }

    res.json({ message: "Notificación marcada como leída" });
  } catch (error) {
    console.error("❌ Error al marcar notificación como leída:", error);
    res
      .status(500)
      .json({ message: "Error interno al marcar notificación como leída" });
  }
};

/**
 * Marcar todas las notificaciones como leídas
 */
export const markAllNotificationsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    await Notification.updateMany(
      { user: userId, read: false },
      { $set: { read: true } }
    );

    res.json({ message: "Todas las notificaciones marcadas como leídas" });
  } catch (error) {
    console.error("❌ Error al marcar todas las notificaciones:", error);
    res
      .status(500)
      .json({ message: "Error interno al marcar todas las notificaciones" });
  }
};
