import express from "express";
import {
  getMessagesByConversation,
  sendMessage,
  markMessageAsRead,
} from "../controllers/message.controller.js";
import { authMiddleware } from "../middlewares/validateToken.js";

const router = express.Router();

// Obtener mensajes de una conversación
router.get("/:conversationId", authMiddleware, getMessagesByConversation);

// Enviar mensaje en una conversación
router.post("/", authMiddleware, sendMessage);

// Marcar mensaje como leído
router.put("/:messageId/read", authMiddleware, markMessageAsRead);

export default router;
