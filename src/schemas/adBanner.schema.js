// src/schemas/ad.schema.js
import { z } from "zod";

// Placements válidos (mismo set que back/front)
export const placements = [
  "home_top",
  "home_bottom",
  "sidebar_right_1",
  "sidebar_right_2",
  "listing_top",
  "listing_inline",
  "community_banner",
  "event_banner",
  "business_banner",
  "custom",
];

// Validador de ObjectId (Mongo)
const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "ID inválido");

// Fechas ISO opcionales/nullable
const isoDateNullable = z
  .string()
  .datetime({ message: "Fecha/hora inválida (ISO)" })
  .nullable()
  .optional();

// Int opcional/nullable (>0)
const intNullable = z.number().int().positive().nullable().optional();

export const adCreateSchema = z
  .object({
    title: z.string().min(2, "Título muy corto").max(140),
    placement: z.enum(placements), // 👈 sin "as const"
    redirectUrl: z.string().url("URL inválida"),
    imageAlt: z.string().max(120).optional().default(""),

    openInNewTab: z.boolean().optional().default(true),
    weight: z.number().int().min(0).optional().default(1),

    maxImpressions: intNullable, // null = sin límite
    maxClicks: intNullable, // null = sin límite

    startAt: isoDateNullable, // null/omitido = empieza ya
    endAt: isoDateNullable, // null/omitido = sin fecha fin

    // MVP: comunidades requeridas (al menos 1)
    communities: z.array(objectId).min(1, "Selecciona al menos 1 comunidad"),

    // Opcionales
    categories: z.array(objectId).optional().default([]),
    businesses: z.array(objectId).optional().default([]),

    // Flags
    isFallback: z.boolean().optional().default(false),
    isActive: z.boolean().optional().default(true),

    // Opcional: si alguna variante llega en JSON (además de multipart)
    imageUrl: z.string().url().optional(),
    imageDesktopUrl: z.string().url().optional(),
    imageTabletUrl: z.string().url().optional(),
    imageMobileUrl: z.string().url().optional(),
  })
  .refine(
    (v) => {
      if (v.startAt && v.endAt) {
        return new Date(v.endAt) >= new Date(v.startAt);
      }
      return true;
    },
    { message: "endAt debe ser posterior o igual a startAt", path: ["endAt"] }
  );

export const adUpdateSchema = adCreateSchema.partial();

// (Opcional) Validación de query para /ads/active
export const adActiveQuerySchema = z.object({
  placement: z.enum(placements, { required_error: "placement es requerido" }),
  communityId: objectId.optional(),
  categoryId: objectId.optional(),
  businessId: objectId.optional(),
  limit: z.coerce.number().int().min(1).max(10).optional().default(1),
  strategy: z
    .enum(["weighted", "random", "all"])
    .optional()
    .default("weighted"),
  includeFallback: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .default("true"),
});

// (Opcional) Validación de query para tracking
export const adTrackQuerySchema = z.object({
  type: z.enum(["impression", "click"]),
});
