import {Router} from 'express';
import { registerUser , loginUser, logoutUser, getUserProfile} from '../controllers/auth.controller.js'; // Asegúrate de crear los controladores
import { authMiddleware } from '../middlewares/validateToken.js';

const router = Router();

// Ruta para el registro de un nuevo usuario  loginUser, getUserProfile
router.post('/register', registerUser);

// Ruta para iniciar sesión de un usuario (login)
router.post('/login', loginUser);

// Ruta para iniciar sesión de un usuario (login)
router.post('/logout', logoutUser);

// Ruta para obtener el perfil de un usuario (requiere autenticación)
router.get('/profile', authMiddleware ,  getUserProfile);

export default router;
