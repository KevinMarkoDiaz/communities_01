import express from 'express';
import { upload } from '../config/cloudinary.js';
import { authMiddleware } from '../middlewares/validateToken.js';
import { hasRole } from '../middlewares/hasRole.js';
import { validateBody } from '../middlewares/validateBody.js';
import { eventSchema } from '../schemas/event.schema.js';
import { createEvent } from '../controllers/event.controller.js';

const router = express.Router(); // ✅ CORRECTO

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

export default router; // ✅ EXPORTACIÓN CORRECTA
