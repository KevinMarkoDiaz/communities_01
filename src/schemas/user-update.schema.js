import { z } from "zod";

export const userUpdateSchema = z.object({
  name: z.string()
    .max(100, { message: "El nombre no puede exceder 100 caracteres" })
    .optional(),

  lastName: z.string()
    .max(100, { message: "El apellido no puede exceder 100 caracteres" })
    .optional(),

  email: z.string()
    .email({ message: "El correo electrónico debe ser válido" })
    .max(255, { message: "El correo no puede exceder 255 caracteres" })
    .optional(),

  title: z.string()
    .max(100, { message: "El título no puede exceder 100 caracteres" })
    .optional(),

  description: z.string()
    .max(1000, { message: "La descripción no puede exceder 1000 caracteres" })
    .optional(),

  location: z.string()
    .max(100, { message: "La ubicación no puede exceder 100 caracteres" })
    .optional(),

  country: z.string()
    .max(100, { message: "El país no puede exceder 100 caracteres" })
    .optional(),

  community: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, { message: "ID de comunidad inválido" })
    .optional(),

  profileImage: z.string()
    .url({ message: "La URL de la imagen de perfil no es válida" })
    .optional(),

  isVerified: z.boolean().optional(),

  updatedAt: z.string()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: "updatedAt debe ser una fecha ISO válida",
    })
    .optional(),
});
