// src/schemas/category.schema.js
import { z } from "zod";

const baseCategorySchema = z.object({
  name: z
    .string()
    .min(1, { message: "El nombre de la categoría es obligatorio" })
    .max(100)
    .trim(),

  description: z
    .string()
    .max(1000, { message: "La descripción no puede exceder 1000 caracteres" })
    .optional(),

  icon: z
    .string()
    .url({ message: "El icono debe ser una URL válida" })
    .max(255)
    .optional(),

  profileImage: z
    .string()
    .url("La imagen debe ser una URL válida")
    .max(500)
    .optional(),
});

// Solo para creación (requiere datos del creador)
export const categoryCreateSchema = baseCategorySchema.extend({
  createdBy: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, { message: "ID de usuario creador inválido" }),
  createdByName: z.string().min(1).max(100),
  createdByRole: z.enum(["admin", "business_owner", "user"]),
});

// Para edición (todos los campos opcionales)
export const categoryUpdateSchema = baseCategorySchema.partial();
