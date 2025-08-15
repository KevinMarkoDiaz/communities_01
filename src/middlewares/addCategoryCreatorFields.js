// src/middlewares/addCategoryCreatorFields.js
import User from "../models/user.model.js";

export async function addCategoryCreatorFields(req, res, next) {
  try {
    const user = await User.findById(req.user.id).select("name role");
    if (!user) return res.status(401).json({ msg: "Usuario no encontrado." });

    req.body.createdBy = user._id;
    req.body.createdByName = user.name || "Usuario";
    req.body.createdByRole = user.role || "user";

    // Si subiste imagen y no vino 'icon' explícito, usa la subida como icono
    if (!req.body.icon && typeof req.body.profileImage === "string") {
      req.body.icon = req.body.profileImage;
    }

    next();
  } catch (err) {
    next(err);
  }
}
