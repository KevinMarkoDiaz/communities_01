import { z } from "zod";

/**
 * ⚠️ Importante:
 * Zod aquí valida SOLO lo que viene del cliente.
 * Los campos del creador (createdBy, createdByName, createdByRole)
 * los inyecta el middleware addCategoryCreatorFields,
 * así que NO deben ser requeridos en este schema.
 */

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

  // Puedes mandar directamente un URL de icono...
  icon: z
    .string()
    .url({ message: "El icono debe ser una URL válida" })
    .max(255)
    .optional(),

  // ...o subir archivo; handleProfileImage pondrá aquí la URL resultante
  profileImage: z
    .string()
    .url("La imagen debe ser una URL válida")
    .max(500)
    .optional(),
});

// Crear: SOLO inputs del cliente (no exigimos createdBy*)
export const categoryCreateSchema = baseCategorySchema;

// Actualizar: todo opcional
export const categoryUpdateSchema = baseCategorySchema.partial();
