import { Router } from 'express';
import {
  createBusiness,
  getAllBusinesses,
  getBusinessById,
  updateBusiness,
  deleteBusiness,
  getMyBusinesses
} from '../controllers/business.controller.js';

import { authMiddleware } from '../middlewares/validateToken.js';
import { hasRole } from '../middlewares/hasRole.js';
import { validateBody } from '../middlewares/validateBody.js';
import { updateBusinessSchema } from '../schemas/business-update.schema.js';
import { businessSchema } from '../schemas/business.schema.js';
import { imageProcessor, uploaderMiddleware } from '../middlewares/imageUpload.middleware.js';


const router = Router();

// Crear negocio (solo admin o business_owner)
router.post(
  '/businesses',
  authMiddleware,
  hasRole('admin', 'business_owner'),
  uploaderMiddleware,
  imageProcessor,
  validateBody(businessSchema),
  createBusiness
);

// Obtener todos los negocios
router.get('/businesses', getAllBusinesses);

router.get(
  '/businesses/mine',
  authMiddleware,
  hasRole('admin', 'business_owner'),
  getMyBusinesses
);
// Obtener negocio por ID
router.get('/businesses/:id', getBusinessById);

// Actualizar negocio (solo owner o admin)
router.put(
  '/businesses/:id',
  authMiddleware,
  hasRole('admin', 'business_owner'),
  uploaderMiddleware,
  imageProcessor,
  validateBody(updateBusinessSchema),
  updateBusiness
);

// Eliminar negocio (solo owner o admin)
router.delete(
  '/businesses/:id',
  authMiddleware,
  hasRole('admin', 'business_owner'),
  deleteBusiness
);

export default router;
