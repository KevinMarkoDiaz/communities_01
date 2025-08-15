// schemas/event.schema.js
import { z } from "zod";

/* -------------------- Helpers -------------------- */

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

const parseJSONIfString = (v) => {
  if (typeof v !== "string") return v;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
};

const toBoolLoose = (v) => {
  if (v === "true") return true;
  if (v === "false") return false;
  return v;
};

const toNumLoose = (v) => {
  if (v === "") return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? v : n;
};

const emptyToUndef = (v) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

/** string u objeto con toString/_id → string ObjectId */
const coerceObjectIdString = z.preprocess((v) => {
  if (v && typeof v === "object") {
    if ("_id" in v) return String(v._id); // { _id: "..." }
    if (typeof v.toString === "function") return v.toString(); // ObjectId
  }
  return v;
}, z.string().regex(OBJECT_ID, { message: "ID inválido" }));

/** Acepta string JSON / CSV / array / objetos con _id / ObjectId → string[] */
const coerceIdArray = z.preprocess((raw) => {
  let arr = raw;

  if (typeof arr === "string") {
    try {
      const j = JSON.parse(arr);
      if (Array.isArray(j)) arr = j;
      else if (OBJECT_ID.test(arr)) arr = [arr];
      else
        arr = String(arr)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
    } catch {
      if (OBJECT_ID.test(arr)) arr = [arr];
      else
        arr = String(arr)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
    }
  }

  if (!Array.isArray(arr)) return [];

  return arr.map((x) => {
    if (x && typeof x === "object") {
      if ("_id" in x) return String(x._id);
      if (typeof x.toString === "function") return x.toString();
      return String(x);
    }
    return String(x);
  });
}, z.array(z.string().regex(OBJECT_ID)).default([]));

/** Acepta tupla [lng,lat] o {lat,lng} → normaliza a tupla [lng,lat] */
const coordsTupleOrLatLngObj = z.preprocess(
  (v) => {
    if (Array.isArray(v) && v.length === 2) return v;
    if (v && typeof v === "object" && ("lat" in v || "lng" in v)) {
      const lat = Number(v.lat);
      const lng = Number(v.lng);
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) return [lng, lat];
    }
    return v;
  },
  z
    .tuple([
      z.number().min(-180).max(180), // lng
      z.number().min(-90).max(90), // lat
    ])
    .optional()
);

/* -------------------- Subesquemas -------------------- */

// location puede venir como JSON string en form-data
const locationSchema = z.preprocess(
  parseJSONIfString,
  z
    .object({
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zipCode: z.string().optional(),
      country: z.string().optional(),
      coordinates: coordsTupleOrLatLngObj,
    })
    .optional()
);

// tags: admite JSON '["a","b"]', CSV "a,b", o string único
const tagsArray = z.preprocess((v) => {
  if (typeof v === "string") {
    try {
      const j = JSON.parse(v);
      if (Array.isArray(j)) return j;
    } catch {}
    return v
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return v;
}, z.array(z.string().min(1)).optional().default([]));

/* -------------------- Schema base -------------------- */

export const eventSchemaBase = z.object({
  title: z
    .string()
    .min(1, { message: "El título es obligatorio" })
    .max(200)
    .trim(),
  description: z
    .string()
    .min(1, { message: "La descripción es obligatoria" })
    .max(2000),

  // fechas/horas desde form-data
  date: z
    .preprocess(
      emptyToUndef,
      z.string().refine((val) => !!val && !isNaN(Date.parse(val)), {
        message: "La fecha debe ser válida (ISO yyyy-mm-dd)",
      })
    )
    .optional(),
  time: z
    .preprocess(
      emptyToUndef,
      z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, {
        message: "La hora debe estar en formato HH:MM (24h)",
      })
    )
    .optional(),

  location: locationSchema,

  // GeoJSON top-level (si lo usas)
  coordinates: z
    .object({
      type: z.literal("Point"),
      coordinates: z.tuple([
        z.number().min(-180).max(180), // lng
        z.number().min(-90).max(90), // lat
      ]),
    })
    .optional(),

  featuredImage: z.preprocess(emptyToUndef, z.string().url().optional()),
  images: z.preprocess(
    parseJSONIfString,
    z.array(z.string().url()).optional().default([])
  ),

  tags: tagsArray,
  language: z.preprocess(
    emptyToUndef,
    z.enum(["es", "en", "pt", "fr"]).optional().default("es")
  ),

  // números/booleans desde strings
  price: z.preprocess(toNumLoose, z.number().min(0).optional().default(0)),
  isPremium: z.preprocess(toBoolLoose, z.boolean().optional()),
  isFree: z.preprocess(toBoolLoose, z.boolean().optional().default(true)),
  isOnline: z.preprocess(toBoolLoose, z.boolean().optional().default(false)),

  registrationLink: z.preprocess(emptyToUndef, z.string().url().optional()),
  virtualLink: z.preprocess(emptyToUndef, z.string().url().optional()),

  communities: coerceIdArray,
  businesses: coerceIdArray,
  categories: coerceIdArray,

  organizer: coerceObjectIdString,
  organizerModel: z.enum(["User", "Business"], {
    errorMap: () => ({
      message: "El organizador debe ser 'User' o 'Business'",
    }),
  }),

  sponsors: coerceIdArray,

  isPublished: z.preprocess(toBoolLoose, z.boolean().optional().default(false)),
  featured: z.preprocess(toBoolLoose, z.boolean().optional().default(false)),

  status: z.preprocess(
    emptyToUndef,
    z.enum(["activo", "finalizado", "cancelado"]).optional().default("activo")
  ),
});

/* -------------------- Reglas condicionales -------------------- */

export const eventSchema = eventSchemaBase.superRefine((data, ctx) => {
  // Si NO es online → dirección obligatoria
  const isOnline = Boolean(data.isOnline);
  if (!isOnline) {
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

/* -------------------- Schema parcial para PUT -------------------- */

export const partialEventSchema = eventSchemaBase.partial();
