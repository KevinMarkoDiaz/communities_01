// middlewares/parseDataField.js
export function parseDataField(req, res, next) {
  try {
    if (req.body?.data) {
      const parsedData = JSON.parse(req.body.data);
      delete req.body.data;

      // si hay URL en JSON y aún no hay valor (no se ha subido file), úsala
      if (!req.body.featuredImage && parsedData.featuredImage) {
        req.body.featuredImage = parsedData.featuredImage;
      }

      // merge NO destructivo: solo escribe si el valor del JSON es útil
      for (const [k, v] of Object.entries(parsedData)) {
        if (v !== undefined && v !== null && v !== "") {
          // ojo: si ya venían archivos (multer) en req.body, no los pises aquí
          if (req.body[k] === undefined || req.body[k] === "") {
            req.body[k] = v;
          }
        }
      }
    }
    next();
  } catch (err) {
    return res.status(400).json({
      msg: "Error al parsear los datos del formulario",
      error: err.message,
    });
  }
}
