import User from "../models/user.model.js";
import Business from "../models/business.model.js";

export const buscarOrganizadores = async (req, res) => {
  const q = req.query.q;
  if (!q || q.length < 2) {
    return res.status(400).json({ msg: "Escribe al menos 2 caracteres" });
  }

  try {
    const [usuarios, negocios] = await Promise.all([
      User.find({ name: { $regex: q, $options: "i" } })
        .select("name _id email")
        .limit(5),
      Business.find({ name: { $regex: q, $options: "i" } })
        .select("name _id")
        .limit(5),
    ]);

    const resultados = [
      ...usuarios.map((u) => ({
        label: `${u.name} (Usuario)`,
        value: u._id,
        model: "User",
      })),
      ...negocios.map((b) => ({
        label: `${b.name} (Negocio)`,
        value: b._id,
        model: "Business",
      })),
    ];

    res.status(200).json(resultados);
  } catch (err) {
    console.error("❌ Error buscando organizadores:", err);
    res.status(500).json({ msg: "Error al buscar organizadores" });
  }
};
