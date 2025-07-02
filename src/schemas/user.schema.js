import { z } from "zod";

// ✅ Registro manual
export const userSchema = z.object({
  name: z
    .string()
    .min(1, { message: "El nombre es obligatorio" })
    .max(100, { message: "El nombre no puede exceder 100 caracteres" })
    .trim(),

  lastName: z
    .string()
    .max(100, { message: "El apellido no puede exceder 100 caracteres" })
    .optional(),

  email: z
    .string()
    .email({ message: "El correo electrónico debe ser válido" })
    .max(255, { message: "El correo no puede exceder 255 caracteres" })
    .trim(),

  password: z
    .string()
    .min(8, { message: "La contraseña debe tener al menos 8 caracteres" })
    .max(128, { message: "La contraseña no puede exceder 128 caracteres" }),

  role: z
    .enum(["user", "admin", "business_owner"], {
      errorMap: () => ({
        message: "El rol debe ser 'user', 'admin' o 'business_owner'",
      }),
    })
    .default("user"),

  isPremium: z.boolean().default(false),

  title: z
    .string()
    .max(100, { message: "El título no puede exceder 100 caracteres" })
    .optional(),

  description: z
    .string()
    .max(1000, { message: "La descripción no puede exceder 1000 caracteres" })
    .optional(),

  location: z
    .string()
    .max(100, { message: "La ubicación no puede exceder 100 caracteres" })
    .optional(),

  country: z
    .string()
    .max(100, { message: "El país no puede exceder 100 caracteres" })
    .optional(),

  community: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, { message: "ID de comunidad inválido" })
    .optional(),

  profileImage: z
    .string()
    .url({ message: "La URL de la imagen de perfil no es válida" })
    .optional(),

  isVerified: z.boolean().optional(),

  createdAt: z
    .string()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: "createdAt debe ser una fecha ISO válida",
    })
    .optional(),

  updatedAt: z
    .string()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: "updatedAt debe ser una fecha ISO válida",
    })
    .optional(),
});

// ✅ Creación de usuario vía Google
export const googleUserSchema = z.object({
  name: z
    .string()
    .min(1, { message: "El nombre es obligatorio" })
    .max(100)
    .trim(),

  email: z.string().email().max(255).trim().optional(), // A veces Google no provee email

  googleId: z.string().min(1, { message: "El googleId es obligatorio" }),

  profileImage: z.string().url().optional(),

  role: z.enum(["user", "admin", "business_owner"]).default("user"),

  isVerified: z.boolean().optional(),
});
