import { z } from "zod";

/**
 * Middleware genérico para validar `req.body` con un esquema Zod.
 * - Si hay errores, devuelve un array de errores legibles.
 * - Si pasa la validación, fusiona los datos parseados con `req.body` existente (para no perder campos como profileImage de Cloudinary).
 */
export const validateBody = (schema) => {
  return (req, res, next) => {
    try {
      const result = schema.safeParse(req.body);

      if (!result.success) {
        const formattedErrors = result.error.errors.map((err) => ({
          path: err.path.join("."),
          message: err.message,
        }));
        // ⚠️ LOG IMPORTANTE PARA DEBUG
        console.error("🧨 Errores de validación Zod:", formattedErrors);
        console.error("📦 req.body original:", req.body);
        return res.status(400).json({ errors: formattedErrors });
      }

      // ✅ Fusiona los datos validados con el body existente
      Object.assign(req.body, result.data);

      next();
    } catch (error) {
      console.error("❌ Error interno en validación de datos Zod:", error);
      res.status(500).json({ msg: "Error interno en validación de datos." });
    }
  };
};
