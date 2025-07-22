import { Router } from "express";
import {
  createEvent,
  getAllEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  getMyEventsController,
  toggleLikeEvent,
} from "../controllers/event.controller.js";

import { authMiddleware } from "../middlewares/validateToken.js";
import { hasRole } from "../middlewares/hasRole.js";
import { validateBody } from "../middlewares/validator.middleware.js";
import { eventSchema } from "../schemas/event.schema.js";
import {
  imageProcessor,
  uploaderMiddleware,
} from "../middlewares/imageUpload.middleware.js";
import { parseDataField } from "../middlewares/parseDataField.js";
import { addOrganizerFields } from "../middlewares/addOrganizerFields.js";

const router = Router();

// Crear evento
router.post(
  "/",
  authMiddleware,
  hasRole("admin", "business_owner"),
  uploaderMiddleware,
  imageProcessor,
  parseDataField,
  addOrganizerFields,
  validateBody(eventSchema),
  createEvent
);

// Obtener todos los eventos
router.get("/", getAllEvents);

// Obtener eventos del usuario autenticado
router.get("/mine", authMiddleware, getMyEventsController);

// Obtener evento por ID
router.get("/:id", getEventById);
// Nueva ruta de resumen

// Actualizar evento
router.put(
  "/:id",
  authMiddleware,
  hasRole("admin", "business_owner"),
  uploaderMiddleware,
  imageProcessor,
  parseDataField,
  addOrganizerFields,
  validateBody(eventSchema.partial()), // permite campos opcionales
  updateEvent
);

// Eliminar evento
router.delete(
  "/:id",
  authMiddleware,
  hasRole("admin", "business_owner"),
  deleteEvent
);

// Like evento
router.put("/:id/like", authMiddleware, toggleLikeEvent);

export default router;
