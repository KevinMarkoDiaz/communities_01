import { z } from "zod";

export const ratingSchema = z.object({
  value: z.number().min(1).max(5),
  targetType: z.enum(["business", "event"]),
  targetId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, { message: "ID de destino inválido" }),
});
