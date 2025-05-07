// 📁 schemas/community.schema.js
import { z } from "zod";

/**
 * Esquema de validación para Comunidades usando Zod.
 * Valida los campos según el modelo Mongoose de Community.
 */
export const communitySchema = z.object({
  name: z.string()
    .min(1, { message: "El nombre de la comunidad es obligatorio" })
    .max(100, { message: "El nombre no puede exceder 100 caracteres" })
    .trim(),

  flagImage: z.string()
    .url({ message: "La URL de la imagen de la bandera no es válida" })
    .optional(),

  description: z.string()
    .max(1000, { message: "La descripción no puede exceder 1000 caracteres" })
    .optional(),

  language: z.string()
    .length(2, { message: "El código de idioma debe tener 2 caracteres" })
    .default("es"),

  owner: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, { message: "ID de usuario propietario inválido" })
});

// Uso en rutas:
// import { validateBody } from '../middlewares/validator.middleware.js';
// import { communitySchema } from '../schemas/community.schema.js';
// router.post('/communities', authMiddleware, hasRole('admin','business_owner'), validateBody(communitySchema), createCommunity);
