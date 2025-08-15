// schemas/business.schema.js
import { z } from "zod";

// Helpers: convertir "" -> undefined
const emptyToUndef = (v) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

// --- Horarios (POST flexible)
const horarioSchema = z
  .object({
    day: z.string().min(1, "El día es obligatorio"),
    closed: z.boolean().optional().default(false),
    open: z.preprocess(
      emptyToUndef,
      z
        .union([
          z
            .string()
            .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, {
              message: "Hora de apertura inválida (HH:mm)",
            }),
          z.undefined(),
          z.null(),
        ])
        .optional()
    ),
    close: z.preprocess(
      emptyToUndef,
      z
        .union([
          z
            .string()
            .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, {
              message: "Hora de cierre inválida (HH:mm)",
            }),
          z.undefined(),
          z.null(),
        ])
        .optional()
    ),
  })
  .refine((d) => d.closed || (d.open && d.close), {
    message:
      "Si el negocio está abierto debes indicar hora de apertura y cierre",
    path: ["open"],
  });

// --- Social
const socialMediaSchema = z.object({
  facebook: z.preprocess(emptyToUndef, z.string().url().optional()),
  instagram: z.preprocess(
    emptyToUndef,
    z
      .string()
      .regex(/^@?[\w\.]{1,30}$|^https?:\/\/.+$/i, {
        message: "Instagram debe ser un @usuario o una URL válida",
      })
      .optional()
  ),
  whatsapp: z.preprocess(emptyToUndef, z.string().optional()),
});

const contactSchema = z.object({
  phone: z.preprocess(emptyToUndef, z.string().min(5).max(20).optional()),
  email: z.preprocess(emptyToUndef, z.string().email().optional()),
  website: z.preprocess(emptyToUndef, z.string().url().optional()),
  socialMedia: socialMediaSchema.optional(),
});

// --- Location (opcional) y coords opcionales
const locationSchema = z.object({
  address: z.preprocess(emptyToUndef, z.string().max(200).optional()),
  city: z.preprocess(emptyToUndef, z.string().max(100).optional()),
  state: z.preprocess(emptyToUndef, z.string().max(100).optional()),
  zipCode: z.preprocess(emptyToUndef, z.string().max(20).optional()),
  country: z.preprocess(emptyToUndef, z.string().min(2).max(100).optional()),
  coordinates: z
    .object({
      type: z.literal("Point").optional(),
      coordinates: z.tuple([z.number(), z.number()]),
    })
    .optional(),
});

// --- Schema de creación (POST)
export const businessSchema = z
  .object({
    name: z.string().min(1).max(100).trim(),
    description: z.string().max(1000),
    categories: z
      .array(
        z
          .string()
          .regex(/^[0-9a-fA-F]{24}$/, { message: "ID de categoría inválido" })
      )
      .min(1, { message: "Debes seleccionar al menos una categoría" }),
    community: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, { message: "ID de comunidad inválido" }),

    // claves que ahora son opcionales/flexibles
    location: locationSchema.optional(),
    contact: contactSchema.optional(),
    openingHours: z.array(horarioSchema).optional(),

    featuredImage: z.preprocess(emptyToUndef, z.string().url().optional()),
    profileImage: z.preprocess(emptyToUndef, z.string().url().optional()),
    images: z.array(z.string().url()).optional(),
    isPremium: z.boolean().optional(),
    tags: z.array(z.string()).optional(),

    isDeliveryOnly: z.boolean().optional(),
    primaryZip: z.preprocess(
      emptyToUndef,
      z
        .string()
        .regex(/^\d{5}$/, { message: "ZIP inválido" })
        .optional()
    ),
  })
  .refine(
    (data) => {
      const loc = data.location || {};
      const hasAddress = Boolean(loc.address && loc.city && loc.state);
      if (hasAddress) return true;
      // Si no hay dirección, permitir delivery-only con ZIP
      if (
        data.isDeliveryOnly &&
        typeof data.primaryZip === "string" &&
        /^\d{5}$/.test(data.primaryZip)
      )
        return true;
      return false;
    },
    {
      message:
        "Debes enviar dirección completa o (delivery-only) un ZIP válido",
    }
  );
