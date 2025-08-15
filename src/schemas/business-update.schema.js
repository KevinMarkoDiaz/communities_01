import { z } from "zod";

// Subesquema de horarios corregido
const horarioSchema = z
  .object({
    day: z.string().min(1, "El día es obligatorio"),
    closed: z.boolean().optional().default(false),
    open: z
      .union([
        z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, {
          message: "Hora de apertura inválida (formato HH:mm)",
        }),
        z.literal(""),
        z.null(),
      ])
      .optional(),
    close: z
      .union([
        z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, {
          message: "Hora de cierre inválida (formato HH:mm)",
        }),
        z.literal(""),
        z.null(),
      ])
      .optional(),
  })
  .refine(
    (data) => {
      if (data.closed) return true;
      return Boolean(data.open) && Boolean(data.close);
    },
    {
      message:
        "Debes proporcionar hora de apertura y cierre si el negocio está abierto.",
      path: ["open"],
    }
  );

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
  phone: z.string().min(5).max(20).optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
  socialMedia: socialMediaSchema.optional(),
});

const locationSchema = z.object({
  address: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  zipCode: z.string().max(20).optional(),
  country: z.string().min(2).max(100).optional(),
  coordinates: z
    .object({
      lat: z.number().optional(),
      lng: z.number().optional(),
    })
    .optional(),
});

// ✅ Esquema actualizado para edición de negocio
export const updateBusinessSchema = z.object({
  name: z.string().max(100).trim().optional(),
  description: z.string().max(1000).optional(),

  // ⬇️ Múltiples categorías permitidas (opcional en updates)
  categories: z
    .array(
      z
        .string()
        .regex(/^[0-9a-fA-F]{24}$/, { message: "ID de categoría inválido" })
    )
    .optional(),

  community: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional(),
  location: locationSchema.optional(),
  contact: contactSchema.optional(),
  openingHours: z.array(horarioSchema).optional(),

  featuredImage: z.string().url().optional(),
  profileImage: z.string().url().optional(),
  images: z.array(z.string().url()).optional(),

  tags: z.array(z.string()).optional(),
  isVerified: z.boolean().optional(),
  owner: z.undefined(), // ⚠️ No actualizable desde frontend
  isDeliveryOnly: z.boolean().optional(),
  primaryZip: z
    .string()
    .regex(/^\d{5}$/)
    .optional(),
});
