import { Router } from 'express';
import {
  createBusiness,
  getAllBusinesses,
  getBusinessById,
  updateBusiness,
  deleteBusiness
} from '../controllers/business.controller.js';

import { authMiddleware } from '../middlewares/validateToken.js';
import { hasRole } from '../middlewares/hasRole.js';

const router = Router();

// Crear negocio (solo admin o business_owner)
router.post('/businesses', authMiddleware, hasRole('admin', 'business_owner'), createBusiness);

// Obtener todos los negocios
router.get('/businesses', getAllBusinesses);

// Obtener negocio por ID
router.get('/businesses/:id', getBusinessById);

// Actualizar negocio (solo owner o admin)
router.put('/businesses/:id', authMiddleware, hasRole('admin', 'business_owner'), updateBusiness);

// Eliminar negocio (solo owner o admin)
router.delete('/businesses/:id', authMiddleware, hasRole('admin', 'business_owner'), deleteBusiness);

export default router;
