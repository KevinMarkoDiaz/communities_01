import { z } from "zod";

export const userUpdateSchema = z.object({
  name: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  title: z.string().max(100).optional(),
  description: z.string().max(1000).optional(),
  location: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  community: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional(),

  profileImage: z
    .union([
      z.string().url(), // cuando viene como URL (actual ya subida)
      z.any().refine(
        // cuando viene como `File` de multer
        (val) =>
          typeof val === "object" &&
          val !== null &&
          (val instanceof File || val.path), // para `req.file` de multer
        { message: "La imagen debe ser un archivo o una URL válida" }
      ),
    ])
    .optional(),

  // ❌ Campos que no deben tocar
  email: z.undefined(),
  isVerified: z.undefined(),
  updatedAt: z.undefined(),
});
