import { Router } from "express";
import Business from "../models/business.model.js";
import Event from "../models/event.model.js";
import Community from "../models/community.model.js";
import { authMiddleware } from "../middlewares/validateToken.js";
import User from "../models/user.model.js";

const router = Router();

// Ruta pública: búsqueda global combinada
router.get("/", async (req, res) => {
  try {
    const q = req.query.q?.toLowerCase() || "";
    const regex = new RegExp(q, "i");

    const [negocios, eventos, comunidades] = await Promise.all([
      Business.find({
        $or: [{ name: regex }, { description: regex }, { tags: regex }],
      })
        .select("name description featuredImage")
        .lean(),

      Event.find({
        $or: [{ title: regex }, { description: regex }, { tags: regex }],
      })
        .select("title description featuredImage date time")
        .lean(),

      Community.find({
        $or: [{ name: regex }, { description: regex }, { language: regex }],
      })
        .select("name description bannerImage language")
        .lean(),
    ]);

    const resultados = [
      ...negocios.map((n) => ({
        tipo: "negocio",
        id: n._id,
        nombre: n.name,
        descripcion: n.description,
        imagen: n.featuredImage,
      })),
      ...eventos.map((e) => ({
        tipo: "evento",
        id: e._id,
        titulo: e.title,
        descripcion: e.description,
        imagen: e.featuredImage,
        fecha: e.date,
        hora: e.time,
      })),
      ...comunidades.map((c) => ({
        tipo: "comunidad",
        id: c._id,
        nombre: c.name,
        descripcion: c.description,
        idioma: c.language,
        imagen: c.bannerImage,
      })),
    ];

    res.json(resultados);
  } catch (error) {
    console.error("❌ Error en búsqueda global:", error);
    res.status(500).json({ error: "Error interno en búsqueda global" });
  }
});

// GET /api/search/organizers?q=texto
router.get(
  "/search/organizers",
  authMiddleware,

  async (req, res) => {
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
  }
);

// GET /api/search/communities?q=colombia&region=dallas
router.get("/search/communities", async (req, res) => {
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
});

export default router;
