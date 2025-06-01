import { z } from "zod";

/**
 * Esquema de validación para Categorías usando Zod.
 * Valida los campos según el modelo Mongoose de Category.
 */
export const categorySchema = z.object({
  name: z.string()
    .min(1, { message: "El nombre de la categoría es obligatorio" })
    .max(100, { message: "El nombre no puede exceder 100 caracteres" })
    .trim(),

  icon: z.string()
    .max(255, { message: "El icono no puede exceder 255 caracteres" })
    .optional(),

  description: z.string()
    .max(1000, { message: "La descripción no puede exceder 1000 caracteres" })
    .optional(),

  createdBy: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, { message: "ID de usuario creador inválido" }),

  createdByName: z.string()
    .min(1, { message: "El nombre del creador es obligatorio" })
    .max(100, { message: "El nombre del creador no puede exceder 100 caracteres" }),

  createdByRole: z.enum(["admin", "business_owner", "user"], {
    required_error: "El rol del creador es obligatorio",
    invalid_type_error: "Rol inválido",
  }),
});
