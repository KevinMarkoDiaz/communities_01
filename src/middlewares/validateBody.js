export const validateBody = (schema) => (req, res, next) => {
  console.log("🧪 Body antes de validar:", req.body);

  try {
    let inputData;

    if (typeof req.body.data === "string") {
      // Si viene de FormData, parsear
      const parsedData = JSON.parse(req.body.data);
      inputData = {
        ...parsedData,
        icon: req.body.profileImage, // ya subido a Cloudinary
      };
    } else {
      // Si viene como JSON normal
      inputData = req.body;
    }

    const validated = schema.parse(inputData);
    req.body = validated; // reemplazamos req.body por la versión validada
    next();
  } catch (err) {
    console.error("❌ Error en validateBody:", err.errors);
    return res
      .status(400)
      .json({ msg: "Error de validación", errors: err.errors });
  }
};
