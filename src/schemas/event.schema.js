import { z } from "zod";

export const eventSchema = z.object({
  title: z
    .string()
    .min(1, { message: "El título es obligatorio" })
    .max(200, { message: "El título no puede exceder 200 caracteres" })
    .trim(),

  description: z
    .string()
    .min(1, { message: "La descripción es obligatoria" })
    .max(2000, { message: "La descripción no puede exceder 2000 caracteres" }),

  date: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: "La fecha debe ser una fecha ISO válida",
    })
    .optional(), // permite dejarla vacía al crear (si querés forzar, quitá esto)

  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, {
      message: "La hora debe estar en formato HH:MM (24h)",
    })
    .optional(),

  location: z
    .object({
      address: z.string().min(1, "Dirección obligatoria").optional(),
      city: z.string().min(1, "Ciudad obligatoria").optional(),
      state: z.string().min(1, "Estado obligatorio").optional(),
      zipCode: z.string().optional(),
      country: z.string().optional(),
      coordinates: z
        .tuple([
          z.number().min(-180).max(180), // lng
          z.number().min(-90).max(90), // lat
        ])
        .optional(),
    })
    .optional(),

  featuredImage: z
    .string()
    .url({ message: "La URL de la imagen no es válida" })
    .optional(),

  images: z
    .array(
      z.string().url({
        message: "La URL de una imagen de galería no es válida",
      })
    )
    .optional()
    .default([]),

  tags: z.array(z.string().min(1)).optional().default([]),

  language: z.string().min(2).max(5).default("es"),

  price: z.number().min(0).optional().default(0),

  isFree: z.boolean().optional().default(true),

  isOnline: z.boolean().optional().default(false),

  registrationLink: z
    .string()
    .trim()
    .refine((val) => val === "" || /^https?:\/\/.+/.test(val), {
      message: "El link de registro debe ser una URL válida",
    })
    .transform((val) => (val === "" ? undefined : val))
    .optional(),

  virtualLink: z
    .string()
    .trim()
    .refine((val) => val === "" || /^https?:\/\/.+/.test(val), {
      message: "El link del evento virtual debe ser una URL válida",
    })
    .transform((val) => (val === "" ? undefined : val))
    .optional(),

  communities: z
    .array(
      z.string().regex(/^[0-9a-fA-F]{24}$/, {
        message: "ID de comunidad inválido",
      })
    )
    .optional()
    .default([]),

  businesses: z
    .array(
      z.string().regex(/^[0-9a-fA-F]{24}$/, {
        message: "ID de negocio inválido",
      })
    )
    .optional()
    .default([]),

  categories: z
    .array(
      z.string().regex(/^[0-9a-fA-F]{24}$/, {
        message: "ID de categoría inválido",
      })
    )
    .optional()
    .default([]),

  organizer: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, { message: "ID de organizador inválido" }),

  organizerModel: z.enum(["User", "Business"], {
    errorMap: () => ({
      message: "El organizador debe ser 'User' o 'Business'",
    }),
  }),

  sponsors: z
    .array(
      z.string().regex(/^[0-9a-fA-F]{24}$/, {
        message: "ID de sponsor inválido",
      })
    )
    .optional()
    .default([]),

  isPublished: z.boolean().optional().default(false),

  featured: z.boolean().optional().default(false),

  status: z
    .enum(["activo", "finalizado", "cancelado"])
    .optional()
    .default("activo"),
});
