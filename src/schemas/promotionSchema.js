import { z } from "zod";

export const promotionSchema = z.object({
  name: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(100, "El nombre no puede exceder 100 caracteres"),

  description: z
    .string()
    .min(1, "La descripción es obligatoria")
    .max(2000, "La descripción no puede exceder 2000 caracteres"),

  type: z.enum(
    ["promo_fin_de_semana", "descuentos_imperdibles", "nuevos_lanzamientos"],
    { errorMap: () => ({ message: "El tipo de promoción no es válido" }) }
  ),

  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "La fecha de inicio no es válida",
  }),

  endDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "La fecha de fin no es válida",
  }),

  business: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, { message: "ID de negocio inválido" }),

  community: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, { message: "ID de comunidad inválido" }),

  category: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, { message: "ID de categoría inválido" }),

  createdBy: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, { message: "ID de creador inválido" }),

  featuredImage: z
    .string()
    .url({ message: "La URL de la imagen no es válida" })
    .optional(), // Este campo se agrega después de procesar la imagen en Cloudinary
});
