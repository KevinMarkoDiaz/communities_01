import { z } from "zod";

/* ---------- Helpers de coerción ---------- */

// Convierte ObjectId/objeto con toString en string
const coerceObjectIdString = z.preprocess((v) => {
  if (v && typeof v === "object" && typeof v.toString === "function") {
    return v.toString();
  }
  return v;
}, z.string().regex(/^[0-9a-fA-F]{24}$/, { message: "ID inválido" }));

// Array de IDs flexible: acepta strings, objetos con _id, ObjectId, etc.
const coerceIdArray = z.preprocess((arr) => {
  if (!Array.isArray(arr)) return [];
  return arr.map((x) => {
    if (x && typeof x === "object") {
      if (typeof x.toString === "function") return x.toString();
      if (x._id) return String(x._id);
      return String(x);
    }
    return String(x);
  });
}, z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).default([]));

// Acepta tupla [lng, lat] o un objeto { lat, lng } y lo normaliza a tupla
const coordsTupleOrLatLngObj = z.preprocess((v) => {
  // Si ya es tupla [lng, lat]
  if (Array.isArray(v) && v.length === 2) return v;
  // Si es objeto { lat, lng }
  if (v && typeof v === "object" && ("lat" in v || "lng" in v)) {
    const lat = Number(v.lat);
    const lng = Number(v.lng);
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      return [lng, lat];
    }
  }
  return v; // dejar que la validación lo marque opcional/incorrecto
}, z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]).optional());

/* ---------- Esquema base ---------- */
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
      address: z.string().optional(), // ← opcional aquí; se vuelve obligatorio en superRefine si no es online
      city: z.string().optional(),
      state: z.string().optional(),
      zipCode: z.string().optional(),
      country: z.string().optional(),
      // Acepta tupla o {lat, lng}, se normaliza a tupla [lng, lat]
      coordinates: coordsTupleOrLatLngObj,
    })
    .optional(),

  // (Opcional) GeoJSON top-level si algún flujo lo envía
  coordinates: z
    .object({
      type: z.literal("Point"),
      coordinates: z.tuple([
        z.number().min(-180).max(180), // lng
        z.number().min(-90).max(90), // lat
      ]),
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

  communities: coerceIdArray, // ← flexible
  businesses: coerceIdArray, // ← flexible
  categories: coerceIdArray, // ← flexible

  organizer: coerceObjectIdString, // ← ahora acepta ObjectId/objeto y lo convierte a string

  organizerModel: z.enum(["User", "Business"], {
    errorMap: () => ({
      message: "El organizador debe ser 'User' o 'Business'",
    }),
  }),

  sponsors: coerceIdArray, // ← flexible

  isPublished: z.boolean().optional().default(false),

  featured: z.boolean().optional().default(false),

  status: z
    .enum(["activo", "finalizado", "cancelado"])
    .optional()
    .default("activo"),
});

/* ---------- Reglas condicionales ---------- */
export const eventSchema = eventSchemaBase.superRefine((data, ctx) => {
  // Dirección obligatoria cuando NO es online
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

  // Si es online, no exigir location.*; y si vino location.coordinates como objeto, ya quedó normalizado a tupla
});

/* ---------- Esquema parcial para updates ---------- */
export const partialEventSchema = eventSchemaBase.partial();
