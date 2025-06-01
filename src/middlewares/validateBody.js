// src/middlewares/validateBody.js
export function validateBody(schema) {
  return (req, res, next) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      return res.status(400).json({
        msg: "Error de validación",
        errors: error.errors,
      });
    }
  };
}
