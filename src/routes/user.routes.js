import express from 'express';
import {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser
} from '../controllers/user.controller.js';

import { registerUser } from '../controllers/auth.controller.js';
import { authMiddleware } from '../middlewares/validateToken.js';
import { isAdmin } from '../middlewares/isAdmin.js';

const router = express.Router();

/**
 * Rutas bajo /api/users
 * Requieren autenticación, salvo que se especifique lo contrario
 */

// 📌 Crear nuevo usuario (solo admin)
router.post('/', authMiddleware, isAdmin, registerUser);

// 📥 Obtener todos los usuarios (solo admin)
router.get('/', authMiddleware, isAdmin, getAllUsers);

// 🔍 Obtener un usuario por ID
router.get('/:id', authMiddleware, getUserById);

// ✏️ Actualizar datos de un usuario (solo el mismo o un admin)
router.put('/:id', authMiddleware, updateUser);

// 🗑️ Eliminar un usuario (solo admin)
router.delete('/:id', authMiddleware, isAdmin, deleteUser);

export default router;
