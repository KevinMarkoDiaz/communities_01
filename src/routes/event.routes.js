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
import {
  singleProfileImageUpload, // usaremos este para "image"
  handleProfileImage        // para subir a Cloudinary y guardar secure_url
} from "../middlewares/imageUpload.middleware.js";

const router = Router();

// Crear evento con imagen (solo admin o business_owner)
router.post(
  "/events",
  authMiddleware,
  hasRole("admin", "business_owner"),
  singleProfileImageUpload,
  handleProfileImage, // ✅ sube la imagen a Cloudinary y setea req.body.image
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
  singleProfileImageUpload,
  handleProfileImage, // ✅ vuelve a subir si hay una nueva imagen
  validateBody(eventSchema.partial()), // permite campos opcionales
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
