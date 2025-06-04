// middleware/parseDataField.js
export const parseDataField = (req, res, next) => {
  if (req.body.data) {
    try {
      const parsed = JSON.parse(req.body.data);
      Object.assign(req.body, parsed);
      delete req.body.data;
    } catch (error) {
      console.error("❌ Error al parsear req.body.data:", error);
      return res.status(400).json({ msg: "El campo 'data' no es un JSON válido." });
    }
  }
  next();
};
