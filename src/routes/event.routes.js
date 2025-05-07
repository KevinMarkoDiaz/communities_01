import { Router } from "express";
import {
  createEvent,
  getAllEvents,
  getEventById,
  updateEvent,
  deleteEvent
} from "../controllers/event.controller.js";

import { authMiddleware } from "../middlewares/validateToken.js";

import { hasRole } from "../middlewares/hasRole.js";

const router = Router();

// Crear evento (admin o business_owner  )
router.post("/events", authMiddleware, hasRole("admin", "business_owner"), createEvent);

// Obtener todos los eventos
router.get("/events", getAllEvents);

// Obtener evento por ID
router.get("/events/:id", getEventById);

// Actualizar evento (admin o creador)
router.put("/events/:id", authMiddleware, hasRole("admin", "business_owner"), updateEvent);

// Eliminar evento (admin o creador)
router.delete("/events/:id", authMiddleware, hasRole("admin", "business_owner"), deleteEvent);

export default router;