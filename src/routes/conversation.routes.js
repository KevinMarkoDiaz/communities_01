import express from "express";
import {
  createOrGetConversation,
  getMyConversations,
} from "../controllers/conversation.controller.js";
import { authMiddleware } from "../middlewares/validateToken.js";

const router = express.Router();

// Crear o recuperar una conversación
router.post("/", authMiddleware, createOrGetConversation);

// Listar todas las conversaciones del usuario autenticado
router.get("/me", authMiddleware, getMyConversations);

export default router;
