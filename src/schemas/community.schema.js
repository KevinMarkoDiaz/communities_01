import { z } from "zod";

// 🔵 Campos comunes que pueden ser compartidos entre POST y PUT
const baseFields = {
  name: z.string()
    .min(1, { message: "El nombre de la comunidad es obligatorio" })
    .max(100, { message: "El nombre no puede exceder 100 caracteres" })
    .trim(),

  flagImage: z.string()
    .url({ message: "La URL de la imagen de la bandera no es válida" }),

  bannerImage: z.string()
    .url({ message: "La URL de la imagen de portada no es válida" }),

  description: z.string()
    .max(1000, { message: "La descripción no puede exceder 1000 caracteres" })
    .optional(),

  language: z.string()
    .length(2, { message: "El código de idioma debe tener 2 caracteres" })
    .default("es"),

  owner: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, { message: "ID de usuario propietario inválido" }),
};

// 🟢 Validación para crear comunidad (POST)
export const communitySchema = z.object(baseFields);

// 🟡 Validación para actualizar comunidad (PUT): todo opcional
export const communityUpdateSchema = z.object({
  name: baseFields.name.optional(),
  flagImage: baseFields.flagImage.optional(),
  bannerImage: baseFields.bannerImage.optional(),
  description: baseFields.description,
  language: baseFields.language.optional(),
  owner: baseFields.owner.optional(),
});

// 🟣 Validación para comunidad completa en respuesta (GET o PUT)
export const fullCommunitySchema = communitySchema.extend({
  _id: z.string(),

  negocios: z.array(
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
  ).optional(),

  eventos: z.array(
    z.object({
      _id: z.string(),
      title: z.string(),
      startDate: z.string(),
      endDate: z.string(),
      imagenDestacada: z.string().optional(),
    })
  ).optional(),
});
