import { z } from "zod";

/**
 * Esquema de validación para Eventos usando Zod.
 * Valida los campos según el modelo Mongoose de Event.
 */
export const eventSchema = z.object({
  title: z.string()
    .min(1, { message: "El título es obligatorio" })
    .max(200, { message: "El título no puede exceder 200 caracteres" })
    .trim(),

  description: z.string()
    .min(1, { message: "La descripción es obligatoria" })
    .max(2000, { message: "La descripción no puede exceder 2000 caracteres" }),

  date: z.string()
    .refine(val => !isNaN(Date.parse(val)), { message: "La fecha debe ser una fecha ISO válida" }),

  location: z.string()
    .min(1, { message: "La ubicación es obligatoria" })
    .max(500, { message: "La ubicación no puede exceder 500 caracteres" }),

  communities: z.array(
    z.string().regex(/^[0-9a-fA-F]{24}$/, { message: "ID de comunidad inválido" })
  ).optional(),

  businesses: z.array(
    z.string().regex(/^[0-9a-fA-F]{24}$/, { message: "ID de negocio inválido" })
  ).optional(),

  categories: z.array(
    z.string().regex(/^[0-9a-fA-F]{24}$/, { message: "ID de categoría inválido" })
  ).optional(),

  organizer: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, { message: "ID de organizador inválido" }),

  organizerModel: z.enum(["User", "Business"], {
    errorMap: () => ({ message: "El organizador debe ser 'User' o 'Business'" })
  }),

  image: z.string()
    .url({ message: "La URL de la imagen no es válida" })
    .optional()
});

// Uso en controladores:
// import { validateBody } from '../middlewares/validator.middleware.js';
// router.post('/events', validateBody(eventSchema), createEvent);
