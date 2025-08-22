import { z } from "zod";

/* Helpers */
const emptyToUndef = (schema) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    schema
  );

const optionalUrl = emptyToUndef(z.string().url());

const stringArrayNoEmpty = z.preprocess(
  (v) =>
    Array.isArray(v)
      ? v.filter((s) => typeof s === "string" && s.trim() !== "")
      : v,
  z.array(z.string().min(1))
);

const ownerId = z.string().regex(/^[0-9a-fA-F]{24}$/, {
  message: "ID de usuario propietario inválido",
});

const mapCenterSchema = z.object({
  type: z.literal("Point"),
  coordinates: z
    .array(z.number())
    .length(2, { message: "Debe contener [lng, lat]" })
    .refine(
      ([lng, lat]) => lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90,
      { message: "Coordenadas fuera de rango" }
    ),
});

/* Enlaces externos */
const externalLinkSchema = z.object({
  title: z.string().min(1, { message: "El título del enlace es obligatorio" }),
  url: z.string().url({ message: "El enlace debe ser una URL válida" }),
  type: z.enum(["facebook", "instagram", "whatsapp", "otro"]).default("otro"),
  description: z.string().optional(),
});

/* ────────────────────────────────────────────────────────────
   CREATE (communitySchema): NO requiere owner
   ──────────────────────────────────────────────────────────── */
export const communitySchema = z.object({
  name: z
    .string()
    .min(1, { message: "El nombre de la comunidad es obligatorio" })
    .max(100, { message: "El nombre no puede exceder 100 caracteres" })
    .trim(),

  flagImage: optionalUrl.optional(),
  bannerImage: optionalUrl.optional(),

  description: z
    .string()
    .max(1000, { message: "La descripción no puede exceder 1000 caracteres" })
    .optional(),

  language: z
    .string()
    .length(2, { message: "El código de idioma debe tener 2 caracteres" })
    .default("es"),

  mapCenter: mapCenterSchema,

  tipo: z.string().optional(),
  region: z.string().optional(),

  externalLinks: z.array(externalLinkSchema).optional(),

  originCountryInfo: z
    .object({
      name: z.string(),
      flag: z.string().url(),
      capital: z.string(),
    })
    .optional(),

  traditions: stringArrayNoEmpty.optional(),

  food: z
    .array(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        image: optionalUrl.optional(), // "" -> undefined
      })
    )
    .optional(),

  resources: z
    .array(
      z.object({
        title: z.string().min(1),
        url: z.string().url(),
        type: z.enum(["legal", "salud", "educación", "otros"]),
      })
    )
    .optional(),

  socialMediaLinks: z
    .object({
      facebook: optionalUrl.optional(),
      instagram: optionalUrl.optional(),
      whatsapp: optionalUrl.optional(),
      youtube: optionalUrl.optional(),
    })
    .partial()
    .optional(),

  metaTitle: emptyToUndef(z.string().optional()),
  metaDescription: emptyToUndef(z.string().optional()),
});

/* ────────────────────────────────────────────────────────────
   UPDATE (communityUpdateSchema): todo opcional; owner opcional
   ──────────────────────────────────────────────────────────── */
export const communityUpdateSchema = z.object({
  name: communitySchema.shape.name.optional(),
  flagImage: communitySchema.shape.flagImage.optional(),
  bannerImage: communitySchema.shape.bannerImage.optional(),
  description: communitySchema.shape.description.optional(),
  language: communitySchema.shape.language.optional(),
  mapCenter: communitySchema.shape.mapCenter.optional(),
  tipo: z.string().optional(),
  region: z.string().optional(),
  externalLinks: communitySchema.shape.externalLinks.optional(),
  originCountryInfo: communitySchema.shape.originCountryInfo.optional(),
  traditions: communitySchema.shape.traditions.optional(),
  food: communitySchema.shape.food.optional(),
  resources: communitySchema.shape.resources.optional(),
  socialMediaLinks: communitySchema.shape.socialMediaLinks.optional(),
  metaTitle: communitySchema.shape.metaTitle.optional(),
  metaDescription: communitySchema.shape.metaDescription.optional(),

  // Admin-only en controller, pero aquí lo permitimos para compatibilidad:
  status: z.enum(["Inactiva", "Pendiente", "Publicada"]).optional(),
  verified: z.boolean().optional(),
  owner: ownerId.optional(),
});

/* ────────────────────────────────────────────────────────────
   FULL RESPONSE (fullCommunitySchema)
   ──────────────────────────────────────────────────────────── */
export const fullCommunitySchema = communitySchema.extend({
  _id: z.string(),
  slug: z.string().optional(),

  owner: ownerId,

  negocios: z
    .array(
      z.object({
        _id: z.string(),
        name: z.string(),
        category: z.any(),
        location: z.object({
          city: z.string(),
          state: z.string(),
        }),
        images: z.array(z.string()).optional(),
      })
    )
    .optional(),

  eventos: z
    .array(
      z.object({
        _id: z.string(),
        title: z.string(),
        startDate: z.string(),
        endDate: z.string(),
        imagenDestacada: optionalUrl.optional(),
      })
    )
    .optional(),

  memberCount: z.number().int().nonnegative().optional(),
  businessCount: z.number().int().nonnegative().optional(),
  eventCount: z.number().int().nonnegative().optional(),
  mostPopularCategory: z.string().optional(),

  populationEstimate: z.number().int().nonnegative().optional(),

  featuredBusinesses: z.array(z.string()).optional(),
  featuredEvents: z.array(z.string()).optional(),

  testimonials: z
    .array(
      z.object({
        name: z.string(),
        message: z.string(),
        avatar: optionalUrl.optional(),
      })
    )
    .optional(),

  moderators: z.array(z.string()).optional(),

  status: z.enum(["Inactiva", "Pendiente", "Publicada"]).optional(),
  verified: z.boolean().optional(),

  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
