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
import { validateBody } from "../middlewares/validator.middleware.js";
import { eventSchema } from "../schemas/event.schema.js";

const router = Router();

// Crear evento (solo admin o business_owner)
router.post(
  "/events",
  authMiddleware,
  hasRole("admin", "business_owner"),
  validateBody(eventSchema),
  createEvent
);

// Obtener todos los eventos (público)
router.get("/events", getAllEvents);

// Obtener evento por ID (público)
router.get("/events/:id", getEventById);

// Actualizar evento (solo admin o creador del evento)
router.put(
  "/events/:id",
  authMiddleware,
  hasRole("admin", "business_owner"),
  validateBody(eventSchema.partial()), // permite actualizar campos opcionales
  updateEvent
);

// Eliminar evento (solo admin o creador del evento)
router.delete(
  "/events/:id",
  authMiddleware,
  hasRole("admin", "business_owner"),
  deleteEvent
);

export default router;
