// src/routes/upload.routes.js
import express from 'express';
import {
  upload,
  imageProcessor
} from '../middlewares/imageUpload.middleware.js';

import { authMiddleware } from '../middlewares/validateToken.js';
import { hasRole } from '../middlewares/hasRole.js';
import { validateBody } from '../middlewares/validateBody.js';
import { eventSchema } from '../schemas/event.schema.js';
import { createEvent } from '../controllers/event.controller.js';

const router = express.Router();

router.post(
  "/events",
  authMiddleware,
  hasRole("admin", "business_owner"),
  upload.single("image"),      // Subida temporal
  imageProcessor,              // Subida a Cloudinary y cleanup
  validateBody(eventSchema),
  createEvent
);

export default router;
