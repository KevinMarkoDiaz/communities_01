import Follow from "../models/follow.model.js";

export async function createFollow(req, res) {
  const { entityType, entityId } = req.body;
  if (!entityType || !entityId) {
    return res
      .status(400)
      .json({ message: "entityType y entityId son requeridos" });
  }
  try {
    const follow = await Follow.create({
      user: req.user._id,
      entityType,
      entityId,
    });
    res.status(201).json({ message: "Seguimiento creado", follow });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(200).json({ message: "Ya seguías esta entidad" });
    }
    res.status(500).json({ message: "Error creando seguimiento" });
  }
}

export async function deleteFollow(req, res) {
  const { entityType, entityId } = req.body;
  if (!entityType || !entityId) {
    return res
      .status(400)
      .json({ message: "entityType y entityId son requeridos" });
  }
  try {
    await Follow.deleteOne({
      user: req.user._id,
      entityType,
      entityId,
    });
    res.json({ message: "Seguimiento eliminado" });
  } catch (err) {
    res.status(500).json({ message: "Error eliminando seguimiento" });
  }
}

export async function listFollows(req, res) {
  const { type } = req.query;
  const filter = { user: req.user._id };
  if (type) filter.entityType = type;
  try {
    const follows = await Follow.find(filter).lean();
    res.json({ items: follows });
  } catch (err) {
    res.status(500).json({ message: "Error cargando seguimientos" });
  }
}
