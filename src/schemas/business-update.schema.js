// src/schemas/business-update.schema.ts (o .js si no usas TS)
import { z } from "zod";

/* ───────────────── Subesquemas ───────────────── */

const horarioSchema = z
  .object({
    day: z.string().min(1, "El día es obligatorio"),
    closed: z.boolean().optional().default(false),
    open: z
      .union([
        z
          .string()
          .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, {
            message: "Hora de apertura inválida (formato HH:mm)",
          })
          .min(1),
        z.literal(""),
        z.null(),
      ])
      .optional(),
    close: z
      .union([
        z
          .string()
          .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, {
            message: "Hora de cierre inválida (formato HH:mm)",
          })
          .min(1),
        z.literal(""),
        z.null(),
      ])
      .optional(),
  })
  .refine(
    (data) => {
      if (data.closed) return true;
      // si está abierto, debe tener open y close no vacíos
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

const coordinatesSchema = z
  .object({
    lat: z.number().optional(),
    lng: z.number().optional(),
  })
  .optional();

const locationSchema = z.object({
  address: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  zipCode: z.string().max(20).optional(),
  country: z.string().min(2).max(100).optional(),
  coordinates: coordinatesSchema,
});

/* ───────────────── Schema de Update ─────────────────
   ⚠️ Importante:
   - featuredImage/profileImage/images/existingImages se validan como URL strings
     (los FILES ya fueron procesados por multer + imageProcessor y convertidos a URL).
   - existingImages se incluye para que NO la elimine el validador, y el back sepa
     exactamente qué URLs conservar/borrar.
*/

export const updateBusinessSchema = z.object({
  // Datos básicos
  name: z.string().max(100).trim().optional(),
  description: z.string().max(1000).optional(),

  // Categorías (IDs de Mongo)
  categories: z
    .array(
      z
        .string()
        .regex(/^[0-9a-fA-F]{24}$/, { message: "ID de categoría inválido" })
    )
    .optional(),

  // Comunidad (ID de Mongo)
  community: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional(),

  // Contacto / ubicación / horarios
  contact: contactSchema.optional(),
  location: locationSchema.optional(),
  openingHours: z.array(horarioSchema).optional(),

  // Imágenes principales (si vienen como URL tras imageProcessor)
  featuredImage: z.string().url().optional(),
  profileImage: z.string().url().optional(),

  // Galería:
  // - existingImages: set final que el usuario dejó en la UI (TODAS deben ser URLs)
  // - images: URLs nuevas agregadas por imageProcessor en esta request
  existingImages: z.array(z.string().url()).optional(),
  images: z.array(z.string().url()).optional(),

  // Extras
  tags: z.array(z.string()).optional(),
  isVerified: z.boolean().optional(),

  // Campos de control
  owner: z.undefined(), // No actualizable desde frontend
  isDeliveryOnly: z.boolean().optional(),
  primaryZip: z
    .string()
    .regex(/^\d{5}$/, "Debe ser un ZIP de 5 dígitos")
    .optional(),

  // Zonas de servicio (si las usas en update)
  serviceAreaZips: z.array(z.string()).optional(),

  // Campos que podrían venir del populate/cliente pero no deben bloquear
  ownerDisplay: z
    .object({
      name: z.string().optional(),
      image: z.string().url().optional(),
    })
    .optional(),
  locationPrecision: z.enum(["address", "zipcode"]).optional(),
  likes: z.array(z.any()).optional(),
  isPremium: z.boolean().optional(),
  feedback: z.array(z.any()).optional(),
  createdAt: z.any().optional(),
  updatedAt: z.any().optional(),
  __v: z.any().optional(),
  id: z.any().optional(),
});
