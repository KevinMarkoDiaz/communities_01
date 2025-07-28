import { z } from "zod";

export const promotionSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(100),
  description: z.string().min(1, "La descripción es obligatoria").max(2000),
  type: z.union([
    z.literal("promo_fin_de_semana"),
    z.literal("descuentos_imperdibles"),
    z.literal("nuevos_lanzamientos"),
  ]),

  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "La fecha de inicio no es válida",
  }),
  endDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "La fecha de fin no es válida",
  }),
  business: z.string().regex(/^[0-9a-fA-F]{24}$/, {
    message: "ID de negocio inválido",
  }),
  community: z.string().regex(/^[0-9a-fA-F]{24}$/, {
    message: "ID de comunidad inválido",
  }),
  category: z.string().regex(/^[0-9a-fA-F]{24}$/, {
    message: "ID de categoría inválido",
  }),
  featuredImage: z
    .string()
    .url({ message: "La URL de la imagen no es válida" })
    .optional(),

  // 🟢 NUEVO: Límite opcional de reclamos
  maxClaims: z
    .number()
    .int({ message: "Debe ser un número entero" })
    .min(1, "Debe ser al menos 1")
    .optional(),
});
