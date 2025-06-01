import {Router} from 'express';
import { registerUser , loginUser, logoutUser, getUserProfile} from '../controllers/auth.controller.js'; // Asegúrate de crear los controladores
import { authMiddleware } from '../middlewares/validateToken.js';
import { body } from 'express-validator';

const router = Router();

// Ruta para el registro de un nuevo usuario  loginUser,    getUserProfile
router.post('/register', registerUser);

// Ruta para iniciar sesión de un usuario (login)
router.post(
  '/login',
  [
    body("email").isEmail().withMessage("Correo inválido"),
    body("password").notEmpty().withMessage("La contraseña es obligatoria"),
  ],
  loginUser
);

// Ruta para iniciar sesión de un usuario (login)
router.post('/logout', logoutUser);

// Ruta para obtener el perfil de un usuario (requiere autenticación)
router.get('/profile', authMiddleware ,  getUserProfile);

export default router;
