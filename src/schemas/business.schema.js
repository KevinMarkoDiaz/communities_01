import { z } from "zod";

/**
 * Esquema de validación para Negocios usando Zod.
 * Valida los campos según el modelo Mongoose de Business.
 */
export const businessSchema = z.object({
  name: z.string()
    .min(1, { message: "El nombre del negocio es obligatorio" })
    .max(100, { message: "El nombre no puede exceder 100 caracteres" })
    .trim(),

  description: z.string()
    .min(1, { message: "La descripción es obligatoria" })
    .max(1000, { message: "La descripción no puede exceder 1000 caracteres" }),

  category: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, { message: "ID de categoría inválido" }),

  community: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, { message: "ID de comunidad inválido" }),

  location: z.object({
    address: z.string()
      .min(1, { message: "La dirección es obligatoria" })
      .max(200, { message: "La dirección no puede exceder 200 caracteres" }),
    city: z.string()
      .min(1, { message: "La ciudad es obligatoria" })
      .max(100, { message: "La ciudad no puede exceder 100 caracteres" }),
    state: z.string()
      .min(1, { message: "El estado es obligatorio" })
      .max(100, { message: "El estado no puede exceder 100 caracteres" }),
    zipCode: z.string()
      .max(20, { message: "El código postal no puede exceder 20 caracteres" })
      .optional(),
    country: z.string()
      .min(2, { message: "El país debe tener al menos 2 caracteres" })
      .max(100, { message: "El país no puede exceder 100 caracteres" }),
    coordinates: z.object({
      lat: z.number().optional(),
      lng: z.number().optional()
    }).optional()
  }),

  contact: z.object({
    phone: z.string()
      .min(5, { message: "El teléfono es obligatorio" })
      .max(20, { message: "El teléfono no puede exceder 20 caracteres" })
      .optional(),
    email: z.string()
      .email({ message: "El correo electrónico no es válido" })
      .optional(),
    website: z.string()
      .url({ message: "La URL del sitio web no es válida" })
      .optional(),
    socialMedia: z.object({
      facebook: z.string().url({ message: "La URL de Facebook no es válida" }).optional(),
      instagram: z.string().url({ message: "La URL de Instagram no es válida" }).optional(),
      whatsapp: z.string().optional()
    }).optional()
  }).optional(),

  owner: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, { message: "ID de propietario inválido" }),

  openingHours: z.array(
    z.object({
      day: z.string(),
      open: z.string(),
      close: z.string()
    })
  ).optional(),

  images: z.array(z.string().url({ message: "La URL de la imagen no es válida" })).optional(),

  isVerified: z.boolean().optional()
});

// Uso en rutas:
// import { validateBody } from '../middlewares/validator.middleware.js';
// import { businessSchema } from '../schemas/business.schema.js';
// router.post('/businesses', authMiddleware, hasRole('business_owner','admin'), validateBody(businessSchema), createBusiness);
