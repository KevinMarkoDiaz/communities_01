export function parseDataField(req, res, next) {
  try {
    if (req.body.data) {
      const parsedData = JSON.parse(req.body.data);

      // ⚠️ Si no hay imagen nueva subida, pero sí hay una URL en el JSON
      if (!req.body.featuredImage && parsedData.featuredImage) {
        req.body.featuredImage = parsedData.featuredImage;
      }

      req.body = {
        ...parsedData,
        ...req.body, // sobrescribe solo si hay campos fuera de data (como archivos)
      };
    }

    next();
  } catch (err) {
    return res.status(400).json({
      msg: "Error al parsear los datos del formulario",
      error: err.message,
    });
  }
}
