export const validateBody = (schema) => (req, res, next) => {
  try {
    const parsed = schema.parse(req.body);
    req.body = parsed; // Reemplaza con versión segura
    next();
  } catch (err) {
    console.error("❌ Error en validateBody:", err.errors); // ⬅️ LOG CLAVE
    return res
      .status(400)
      .json({ msg: "Error de validación", errors: err.errors });
  }
};
