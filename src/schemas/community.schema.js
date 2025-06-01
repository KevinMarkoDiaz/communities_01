import { z } from "zod";

// 🎯 Esquema básico para creación de comunidades (POST)
export const communitySchema = z.object({
  name: z.string()
    .min(1, { message: "El nombre de la comunidad es obligatorio" })
    .max(100, { message: "El nombre no puede exceder 100 caracteres" })
    .trim(),

  flagImage: z.string()
    .url({ message: "La URL de la imagen de la bandera no es válida" })
    .optional(),

  description: z.string()
    .max(1000, { message: "La descripción no puede exceder 1000 caracteres" })
    .optional(),

  language: z.string()
    .length(2, { message: "El código de idioma debe tener 2 caracteres" })
    .default("es"),

  owner: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, { message: "ID de usuario propietario inválido" }),
});


// 🎯 Esquema extendido para respuesta de comunidad completa (GET / PUT)
export const fullCommunitySchema = communitySchema.extend({
  _id: z.string(),

  negocios: z.array(
    z.object({
      _id: z.string(),
      name: z.string(),
      category: z.any(), // puede ser un ID (string) o un objeto populado
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
