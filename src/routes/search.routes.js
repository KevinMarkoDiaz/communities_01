import { Router } from "express";
import Business from "../models/business.model.js";
import Event from "../models/event.model.js";
import Community from "../models/community.model.js";

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

export default router;
