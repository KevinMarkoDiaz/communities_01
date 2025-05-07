import express from 'express';
import { getAllUsers, getUserById, updateUser, deleteUser } from '../controllers/user.controller.js';
import { authMiddleware } from '../middlewares/validateToken.js';
import { isAdmin } from '../middlewares/isAdmin.js';
import { registerUser } from '../controllers/auth.controller.js';

const router = express.Router();

// Rutas para la gestión de usuarios (requiere autenticación)

// 1. Listar todos los usuarios (solo admin)
router.get('/users', authMiddleware, isAdmin, getAllUsers);

// 2. Obtener un usuario por ID
router.get('/users/:id', authMiddleware, getUserById);

// 3. Actualizar datos de un usuario (solo el mismo usuario o admin)
router.put('/users/:id', authMiddleware, updateUser);

// 4. Eliminar un usuario (solo admin)
router.delete('/users/:id', authMiddleware, isAdmin, deleteUser);

// 4. crear un usuario (solo admin)
router.post('/users', authMiddleware, isAdmin, registerUser);

export default router;
