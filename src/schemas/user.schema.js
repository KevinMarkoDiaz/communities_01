import { z } from "zod";

/**
 * Esquema de validación para usuarios usando Zod.
 * Valida tanto los campos obligatorios como opcionales según el modelo de Mongoose.
 */
export const userSchema = z.object({
  name: z.string()
    .min(1, { message: "El nombre es obligatorio" })
    .max(100, { message: "El nombre no puede exceder 100 caracteres" })
    .trim(),

  email: z.string()
    .email({ message: "El correo electrónico debe ser válido" })
    .max(255, { message: "El correo no puede exceder 255 caracteres" })
    .trim(),

  password: z.string()
    .min(8, { message: "La contraseña debe tener al menos 8 caracteres" })
    .max(128, { message: "La contraseña no puede exceder 128 caracteres" }),

  role: z.enum(["user", "admin", "business_owner"], {
    errorMap: () => ({ message: "El rol debe ser 'user', 'admin' o 'business_owner'" })
  }).default("user"),

  community: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, { message: "ID de comunidad inválido" })
    .optional(),

  profileImage: z.string()
    .url({ message: "La URL de la imagen de perfil no es válida" })
    .optional(),

  isVerified: z.boolean().optional(),

  // createdAt y updatedAt se manejan automáticamente en el servidor,
  // pero si se envían se validan como fecha ISO.
  createdAt: z.string()
    .refine(val => !val || !isNaN(Date.parse(val)), {
      message: "createdAt debe ser una fecha ISO válida"
    })
    .optional(),

  updatedAt: z.string()
    .refine(val => !val || !isNaN(Date.parse(val)), {
      message: "updatedAt debe ser una fecha ISO válida"
    })
    .optional()
});
