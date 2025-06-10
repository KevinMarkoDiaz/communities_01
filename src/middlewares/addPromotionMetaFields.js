// middlewares/addPromotionMetaFields.js
export function addPromotionMetaFields(req, res, next) {
  try {
    const parsed = JSON.parse(req.body.data || "{}");

    // Asegurar createdBy
    if (req.user?.id) {
      parsed.createdBy = req.user.id;
    }

    // Si community ya viene no hacemos nada
    if (!parsed.community) {
      console.warn(
        "⚠️ Faltaba community en req.body.data, no se pudo autoasignar"
      );
    }

    // Reasignar al req.body con los nuevos campos
    req.body = {
      ...parsed,
      featuredImage: req.body.featuredImage,
    };

    next();
  } catch (error) {
    console.error(
      "❌ Error al parsear req.body.data en addPromotionMetaFields:",
      error
    );
    res.status(400).json({ msg: "Error al procesar los datos del formulario" });
  }
}
