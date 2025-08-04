import Business from "../models/business.model.js";
import Event from "../models/event.model.js";
import Community from "../models/community.model.js";

export const buscarGlobal = async (req, res) => {
  try {
    const q = req.query.q?.toLowerCase() || "";
    const regex = new RegExp(q, "i");

    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const coordsValidas = !isNaN(lat) && !isNaN(lng);

    const geoFiltroNegocios = coordsValidas
      ? {
          "location.coordinates": {
            $near: {
              $geometry: { type: "Point", coordinates: [lng, lat] },
              $maxDistance: 128700, // 80 millas en metros
            },
          },
        }
      : {};

    const geoFiltroEventos = coordsValidas
      ? {
          coordinates: {
            $near: {
              $geometry: { type: "Point", coordinates: [lng, lat] },
              $maxDistance: 128700,
            },
          },
        }
      : {};

    const geoFiltroComunidades = coordsValidas
      ? {
          mapCenter: {
            $near: {
              $geometry: { type: "Point", coordinates: [lng, lat] },
              $maxDistance: 128700,
            },
          },
        }
      : {};

    const [negocios, eventos, comunidades] = await Promise.all([
      Business.find({
        ...geoFiltroNegocios,
        $or: [{ name: regex }, { description: regex }, { tags: regex }],
      })
        .select("_id name featuredImage isPremium")
        .limit(10)
        .lean(),

      Event.find({
        ...geoFiltroEventos,
        $or: [{ title: regex }, { description: regex }, { tags: regex }],
      })
        .select("_id title featuredImage isPremium")
        .limit(10)
        .lean(),

      Community.find({
        ...geoFiltroComunidades,
        $or: [{ name: regex }, { description: regex }, { language: regex }],
      })
        .select("_id name bannerImage")
        .limit(10)
        .lean(),
    ]);

    const resultados = [
      ...negocios.map((n) => ({
        tipo: "negocio",
        id: n._id,
        titulo: n.name,
        imagen: n.featuredImage,
        isPremium: n.isPremium || false,
      })),
      ...eventos.map((e) => ({
        tipo: "evento",
        id: e._id,
        titulo: e.title,
        imagen: e.featuredImage,
        isPremium: e.isPremium || false,
      })),
      ...comunidades.map((c) => ({
        tipo: "comunidad",
        id: c._id,
        titulo: c.name,
        imagen: c.bannerImage,
      })),
    ];

    res.json(resultados);
  } catch (error) {
    console.error("❌ Error en búsqueda global:", error);
    res.status(500).json({ error: "Error interno en búsqueda global" });
  }
};
