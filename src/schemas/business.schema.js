import { z } from "zod";

// Subesquemas reutilizables
const horarioSchema = z
  .object({
    day: z.string(),
    closed: z.boolean().optional(),
    open: z
      .string()
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
      .optional(),
    close: z
      .string()
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
      .optional(),
  })
  .refine((val) => val.closed || (val.open && val.close), {
    message: "Día abierto requiere horas de apertura y cierre",
  });

const socialMediaSchema = z.object({
  facebook: z.string().url().optional(),
  instagram: z
    .string()
    .regex(/^@?[\w\.]{1,30}$|^https?:\/\/.+$/i, {
      message: "Instagram debe ser un @usuario o una URL válida",
    })
    .optional(),
  whatsapp: z.string().optional(),
});

const contactSchema = z.object({
  phone: z.string().min(5).max(20),
  email: z.string().email(),
  website: z.string().url().optional(),
  socialMedia: socialMediaSchema.optional(),
});

const locationSchema = z.object({
  address: z.string().max(200),
  city: z.string().max(100),
  state: z.string().max(100),
  zipCode: z.string().max(20).optional(),
  country: z.string().min(2).max(100),
  coordinates: z.object({
    type: z.literal("Point"),
    coordinates: z
      .tuple([z.number(), z.number()]) // [lng, lat]
      .refine(
        ([lng, lat]) => lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90,
        { message: "Coordenadas fuera de rango válido" }
      ),
  }),
});

// ✅ Esquema completo de negocio
export const businessSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(1000),
  category: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, { message: "ID de categoría inválido" }),
  community: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, { message: "ID de comunidad inválido" }),

  location: locationSchema,
  contact: contactSchema,
  openingHours: z.array(horarioSchema).optional(),

  featuredImage: z.string().url().optional(),
  profileImage: z.string().url().optional(),
  images: z.array(z.string().url()).optional(),

  tags: z.array(z.string()).optional(),
});
