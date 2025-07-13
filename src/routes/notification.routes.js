import express from "express";
import {
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../controllers/notification.controller.js";
import { authMiddleware } from "../middlewares/validateToken.js";

const router = express.Router();

router.get("/notifications", authMiddleware, getUserNotifications);
router.patch("/notifications/:id/read", authMiddleware, markNotificationRead);
router.patch(
  "/notifications/read-all",
  authMiddleware,
  markAllNotificationsRead
);

export default router;
