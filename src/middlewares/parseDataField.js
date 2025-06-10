export function parseDataField(req, res, next) {
  try {
    if (req.body.data) {
      const parsedData = JSON.parse(req.body.data);
      req.body = {
        ...parsedData,
        ...req.body, // <- esto mantiene campos como featuredImage que ya se agregaron
      };
    }
    next();
  } catch (err) {
    return res
      .status(400)
      .json({
        msg: "Error al parsear los datos del formulario",
        error: err.message,
      });
  }
}
