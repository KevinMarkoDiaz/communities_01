// middlewares/addPromotionMetaFields.js

export function addPromotionMetaFields(req, res, next) {
  try {
    const body = req.body;

    if (!body || typeof body !== "object") {
      return res
        .status(400)
        .json({ msg: "Faltan datos en el formulario de promoción" });
    }

    // Añadir createdBy si no está presente
    if (req.user?.id && !body.createdBy) {
      body.createdBy = req.user.id;
    }

    // Continúa con el siguiente middleware/controlador
    next();
  } catch (error) {
    console.error("❌ Error en addPromotionMetaFields:", error);
    res.status(400).json({ msg: "Error al procesar los datos del formulario" });
  }
}
