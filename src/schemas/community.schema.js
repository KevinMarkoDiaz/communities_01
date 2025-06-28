import { z } from "zod";

// 🔵 Campos base compartidos
const baseFields = {
  name: z
    .string()
    .min(1, { message: "El nombre de la comunidad es obligatorio" })
    .max(100, { message: "El nombre no puede exceder 100 caracteres" })
    .trim(),
  flagImage: z
    .string()
    .url({ message: "La URL de la imagen de la bandera no es válida" })
    .optional(),

  bannerImage: z
    .string()
    .url({ message: "La URL de la imagen de portada no es válida" })
    .optional(),

  description: z
    .string()
    .max(1000, { message: "La descripción no puede exceder 1000 caracteres" })
    .optional(),

  language: z
    .string()
    .length(2, { message: "El código de idioma debe tener 2 caracteres" })
    .default("es"),

  owner: z.string().regex(/^[0-9a-fA-F]{24}$/, {
    message: "ID de usuario propietario inválido",
  }),
};

// 🟢 Validación para crear comunidad
export const communitySchema = z.object(baseFields);

// 🟡 Validación para actualizar comunidad
export const communityUpdateSchema = z.object({
  name: baseFields.name.optional(),
  flagImage: baseFields.flagImage.optional(),
  bannerImage: baseFields.bannerImage.optional(),
  description: baseFields.description,
  language: baseFields.language.optional(),
  owner: baseFields.owner.optional(),
});

// 🟣 Esquema extendido para la respuesta completa
export const fullCommunitySchema = communitySchema.extend({
  _id: z.string(),

  // Relaciones
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
        imagenDestacada: z.string().optional(),
      })
    )
    .optional(),

  // Métricas
  memberCount: z.number().int().nonnegative().optional(),
  businessCount: z.number().int().nonnegative().optional(),
  eventCount: z.number().int().nonnegative().optional(),
  mostPopularCategory: z.string().optional(),

  // Social/Cultural
  populationEstimate: z.number().int().nonnegative().optional(),
  originCountryInfo: z
    .object({
      name: z.string(),
      flag: z.string().url(),
      capital: z.string(),
    })
    .optional(),

  traditions: z.array(z.string()).optional(),
  food: z
    .array(
      z.object({
        name: z.string(),
        description: z.string().optional(),
        image: z.string().url().optional(),
      })
    )
    .optional(),

  // Engagement
  featuredBusinesses: z.array(z.string()).optional(),
  featuredEvents: z.array(z.string()).optional(),
  testimonials: z
    .array(
      z.object({
        name: z.string(),
        message: z.string(),
        avatar: z.string().url().optional(),
      })
    )
    .optional(),
  moderators: z.array(z.string()).optional(),

  // Recursos
  resources: z
    .array(
      z.object({
        title: z.string(),
        url: z.string().url(),
        type: z.enum(["legal", "salud", "educación", "otros"]),
      })
    )
    .optional(),

  socialMediaLinks: z
    .object({
      facebook: z.string().url().optional(),
      instagram: z.string().url().optional(),
      whatsapp: z.string().url().optional(),
      youtube: z.string().url().optional(),
    })
    .optional(),

  // Ubicación y geografía
  region: z.string().optional(),
  mapCenter: z
    .object({
      lat: z.number(),
      lng: z.number(),
    })
    .optional(),

  // SEO y presentación
  slug: z.string().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),

  // Admin
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  status: z.enum(["Inactiva", "Pendiente", "Publicada"]).optional(),
  verified: z.boolean().optional(),
});
