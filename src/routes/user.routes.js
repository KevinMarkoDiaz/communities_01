import { Router } from "express";
import {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  buscarUsuariosPorNombre,
} from "../controllers/user.controller.js";

import { registerUser } from "../controllers/auth.controller.js";
import { authMiddleware } from "../middlewares/validateToken.js";
import { isAdmin } from "../middlewares/isAdmin.js";
import { validateBody } from "../middlewares/validateBody.js";
import { userSchema } from "../schemas/user.schema.js";
import { userUpdateSchema } from "../schemas/user-update.schema.js";

import {
  singleProfileImageUpload,
  handleProfileImage,
} from "../middlewares/imageUpload.middleware.js";

import { parseDataField } from "../middlewares/parseDataField.js";

const router = Router();

/**
 * Rutas bajo /api/users
 */

// 📌 Crear nuevo usuario (solo admin)
router.post(
  "/",
  authMiddleware,
  isAdmin,
  validateBody(userSchema),
  registerUser
);

// 📥 Obtener todos los usuarios (solo admin)
router.get("/", authMiddleware, isAdmin, getAllUsers);

// 🔍 Buscar usuarios por nombre (admin)
router.get("/search", authMiddleware, isAdmin, buscarUsuariosPorNombre);

// 🔍 Obtener un usuario por ID
router.get("/:id", authMiddleware, getUserById);

// ✏️ Actualizar usuario (orden correcto multipart)
router.put(
  "/:id",
  authMiddleware,
  singleProfileImageUpload, // 1) multer
  parseDataField, // 2) fusiona req.body.data si vino
  handleProfileImage, // 3) sube imagen y setea URL en req.body.profileImage
  validateBody(userUpdateSchema), // 4) valida inputs del cliente
  updateUser // 5) controlador
);

// 🗑️ Eliminar usuario (solo admin)
router.delete("/:id", authMiddleware, isAdmin, deleteUser);

export default router;
