// src/controllers/notification.controller.js
import Notification from "../models/Notification.model.js";

/**
 * Obtener las notificaciones del usuario autenticado
 */
export const getUserNotifications = async (req, res) => {
  try {
    const userId = req.user.id;

    const notifications = await Notification.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ notifications });
  } catch (error) {
    console.error("❌ Error al obtener notificaciones:", error);
    res.status(500).json({ msg: "Error al obtener notificaciones" });
  }
};

/**
 * Marcar una notificación como leída
 */
export const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findById(id);
    if (!notification) {
      return res.status(404).json({ msg: "Notificación no encontrada" });
    }

    if (notification.user.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ msg: "No tienes permisos sobre esta notificación" });
    }

    notification.read = true;
    await notification.save();

    res.json({ message: "Notificación marcada como leída" });
  } catch (error) {
    console.error("❌ Error al marcar notificación:", error);
    res.status(500).json({ msg: "Error al marcar notificación" });
  }
};
