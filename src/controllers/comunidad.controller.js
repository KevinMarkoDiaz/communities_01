import Community from "../models/community.model.js";

export const buscarComunidades = async (req, res) => {
  const q = req.query.q || "";
  const region = req.query.region;

  try {
    const query = {
      $and: [
        {
          $or: [
            { name: { $regex: q, $options: "i" } },
            { description: { $regex: q, $options: "i" } },
          ],
        },
      ],
    };

    if (region) {
      query.$and.push({ region: { $regex: region, $options: "i" } });
    }

    const comunidades = await Community.find(query)
      .select("name description bannerImage region slug language")
      .limit(10);

    res.status(200).json(comunidades);
  } catch (err) {
    console.error("❌ Error buscando comunidades:", err);
    res.status(500).json({ msg: "Error al buscar comunidades" });
  }
};
