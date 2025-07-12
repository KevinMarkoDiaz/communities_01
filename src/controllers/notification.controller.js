import Notification from "../models/Notification.model.js";

export const getUserNotifications = async (req, res) => {
  const userId = req.user.id;

  const notifications = await Notification.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(50);

  res.json({ notifications });
};

export const markNotificationRead = async (req, res) => {
  const { id } = req.params;

  await Notification.findByIdAndUpdate(id, { read: true });

  res.json({ message: "Notificación marcada como leída" });
};
