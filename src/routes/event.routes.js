import { Router } from "express";
import {
  createEvent,
  getAllEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  getMyEventsController,
} from "../controllers/event.controller.js";

import { authMiddleware } from "../middlewares/validateToken.js";
import { hasRole } from "../middlewares/hasRole.js";
import { validateBody } from "../middlewares/validator.middleware.js";
import { eventSchema } from "../schemas/event.schema.js";

import { upload } from "../config/cloudinary.js";

const router = Router();

// Crear evento con imagen (solo admin o business_owner)
router.post(
  "/events",
  authMiddleware,
  hasRole("admin", "business_owner"),
  upload.single("image"),
  (req, res, next) => {
    if (req.file) {
      req.body.image = req.file.path;
    }
    next();
  },
  validateBody(eventSchema),
  createEvent
);

// Obtener todos los eventos (público)
router.get("/events", getAllEvents);

// Obtener eventos del usuario autenticado
router.get(
  "/events/mine",
  authMiddleware,
  hasRole("admin", "business_owner"),
  getMyEventsController
);

// Obtener evento por ID (público)
router.get("/events/:id", getEventById);

// Actualizar evento con imagen
router.put(
  "/events/:id",
  authMiddleware,
  hasRole("admin", "business_owner"),
  upload.single("image"),
  (req, res, next) => {
    if (req.file) {
      req.body.image = req.file.path;
    }
    next();
  },
  validateBody(eventSchema.partial()), // permite actualizar campos opcionales
  updateEvent
);

// Eliminar evento
router.delete(
  "/events/:id",
  authMiddleware,
  hasRole("admin", "business_owner"),
  deleteEvent
);

export default router;
