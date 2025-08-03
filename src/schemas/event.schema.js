import { z } from "zod";

// Esquema base sin validaciones condicionales
export const eventSchemaBase = z.object({
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
    .optional(),

  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, {
      message: "La hora debe estar en formato HH:MM (24h)",
    })
    .optional(),

  location: z
    .object({
      address: z.string(),
      city: z.string(),
      state: z.string(),
      zipCode: z.string().optional(),
      country: z.string().optional(),
      coordinates: z
        .tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])
        .optional(),
    })
    .optional(),

  featuredImage: z
    .string()
    .url({ message: "La URL de la imagen no es válida" })
    .optional(),

  images: z
    .array(
      z
        .string()
        .url({ message: "La URL de una imagen de galería no es válida" })
    )
    .optional()
    .default([]),

  tags: z.array(z.string().min(1)).optional().default([]),

  language: z.string().min(2).max(5).default("es"),

  price: z.number().min(0).optional().default(0),
  isPremium: z.boolean().optional(),
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
    .array(z.string().regex(/^[0-9a-fA-F]{24}$/))
    .optional()
    .default([]),

  businesses: z
    .array(z.string().regex(/^[0-9a-fA-F]{24}$/))
    .optional()
    .default([]),

  categories: z
    .array(z.string().regex(/^[0-9a-fA-F]{24}$/))
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
    .array(z.string().regex(/^[0-9a-fA-F]{24}$/))
    .optional()
    .default([]),

  isPublished: z.boolean().optional().default(false),

  featured: z.boolean().optional().default(false),

  status: z
    .enum(["activo", "finalizado", "cancelado"])
    .optional()
    .default("activo"),
});

// Esquema con validaciones condicionales
export const eventSchema = eventSchemaBase.superRefine((data, ctx) => {
  if (!data.isOnline) {
    const loc = data.location || {};

    if (!loc.address?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["location", "address"],
        message: "Dirección obligatoria",
      });
    }

    if (!loc.city?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["location", "city"],
        message: "Ciudad obligatoria",
      });
    }

    if (!loc.state?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["location", "state"],
        message: "Estado obligatorio",
      });
    }
  }
});

// Esquema parcial para updates
export const partialEventSchema = eventSchemaBase.partial();
