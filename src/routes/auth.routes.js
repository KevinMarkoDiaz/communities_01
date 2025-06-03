import { Router } from 'express';
import {
  registerUser,
  loginUser,
  logoutUser,
  getUserProfile,
  getCurrentUser,  
} from '../controllers/auth.controller.js';

import { authMiddleware } from '../middlewares/validateToken.js';
import { validateBody } from '../middlewares/validateBody.js';
import { userSchema } from '../schemas/user.schema.js';
import { loginSchema } from '../schemas/login.schema.js'; // lo creamos abajo
import { userUpdateSchema } from '../schemas/user-update.schema.js';

import {
  singleProfileImageUpload,
  handleProfileImage
} from '../middlewares/imageUpload.middleware.js';
import { updateUser } from '../controllers/user.controller.js';

const router = Router();

// 📥 Registro público de usuarios
router.post('/register', validateBody(userSchema), registerUser);

// 🔐 Login con validación Zod
router.post('/login', validateBody(loginSchema), loginUser);

// 🚪 Logout (opcional según tu auth)
router.post('/logout', logoutUser);

// 👤 Perfil del usuario autenticado
router.get('/profile', authMiddleware, getUserProfile);

// 🧑 Datos del usuario actual (útil para el frontend)
router.get('/me', authMiddleware, getCurrentUser);

// ✏️ Actualizar perfil del usuario autenticado (opcional)
router.put(
  '/profile',
  authMiddleware,
  singleProfileImageUpload,
  handleProfileImage,
  validateBody(userUpdateSchema),
  updateUser
);

export default router;
