import { z } from "zod";

/**
 * Middleware genérico de validación con Zod.
 * Envuelve la validación en un try/catch para manejo de errores.
 * @param schema - Un esquema Zod para validar req.body
 * @returns Middleware de Express
 */
export const validateBody = (schema) => {
  return (req, res, next) => {
    try {
      const result = schema.safeParse(req.body);
      if (!result.success) {
        // Formatea y retorna los errores de validación
        return res.status(400).json({ errors: result.error.format() });
      }
      // Reemplaza req.body con los datos validados y transformados
      req.body = result.data;
      next();
    } catch (error) {
      console.error("Error en validación de datos:", error);
      res.status(500).json({ msg: "Error interno de validación." });
    }
  };
};

// Ejemplo de uso en rutas:
// import { validateBody } from '../middlewares/validator.middleware.js';
// import { userSchema } from '../schemas/user.schema.js';
// router.post('/users', validateBody(userSchema), registerUser);