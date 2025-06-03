import { z } from "zod";

/**
 * Middleware genérico para validar `req.body` con un esquema Zod.
 * - Si hay errores, devuelve un array de errores legibles.
 * - Si pasa la validación, reemplaza `req.body` con los datos ya parseados y limpios.
 * @param {z.ZodSchema} schema - Esquema Zod a usar para validación
 */
export const validateBody = (schema) => {
  return (req, res, next) => {
    try {
      const result = schema.safeParse(req.body);

      if (!result.success) {
        // Devuelve los errores en formato plano (path + mensaje)
        const formattedErrors = result.error.errors.map((err) => ({
          path: err.path.join('.'),
          message: err.message,
        }));

        return res.status(400).json({ errors: formattedErrors });
      }

      // Si es válido, reemplaza el body con los datos parseados
      req.body = result.data;
      next();
    } catch (error) {
      console.error("❌ Error interno en validación de datos Zod:", error);
      res.status(500).json({ msg: "Error interno en validación de datos." });
    }
  };
};
