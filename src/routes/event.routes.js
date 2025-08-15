// src/routes/event.routes.js
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
import { eventSchema, partialEventSchema } from "../schemas/event.schema.js";

import {
  imageProcessor,
  uploaderMiddleware,
} from "../middlewares/imageUpload.middleware.js";
import { parseDataField } from "../middlewares/parseDataField.js";
import { addOrganizerFields } from "../middlewares/addOrganizerFields.js";

const router = Router();

/**
 * Orden recomendado para POST/PUT con multipart:
 * 1) authMiddleware                         → autenticar
 * 2) hasRole                                → autorizar
 * 3) uploaderMiddleware                      → multer (recibe featuredImage/images)
 * 4) imageProcessor                          → procesa/almacena y deja URLs en req.body si aplica
 * 5) parseDataField                          → fusiona req.body.data (JSON string) a req.body
 * 6) addOrganizerFields                      → completa organizer/organizerModel en base a req.user
 * 7) validateBody(eventSchema/partialSchema) → valida con Zod (ahora organizer ya es string)
 * 8) controller                              → lógica de negocio y guardado
 */

// Crear evento
router.post(
  "/",
  authMiddleware,
  hasRole("admin", "business_owner", "user"),
  uploaderMiddleware,
  parseDataField,
  imageProcessor,
  addOrganizerFields,
  validateBody(eventSchema),
  createEvent
);

// Obtener todos los eventos (con filtros opcionales por lat/lng/paginación)
router.get("/", getAllEvents);

// Obtener eventos del usuario autenticado
router.get("/mine", authMiddleware, getMyEventsController);

// Obtener evento por ID
router.get("/:id", getEventById);

// Actualizar evento
router.put(
  "/:id",
  authMiddleware,
  hasRole("admin", "business_owner"),
  uploaderMiddleware,
  parseDataField,
  imageProcessor,
  addOrganizerFields,
  validateBody(partialEventSchema),
  updateEvent
);

// Eliminar evento
router.delete(
  "/:id",
  authMiddleware,
  hasRole("admin", "business_owner"),
  deleteEvent
);

// Toggle Like
router.put("/:id/like", authMiddleware, toggleLikeEvent);

export default router;
