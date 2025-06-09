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
        $or: [{ nombre: regex }, { descripcion: regex }, { categoria: regex }],
      })
        .select("nombre descripcion categoria featuredImage comunidad")
        .populate("comunidad", "name flagImage") // solo nombre y bandera
        .lean(),

      Event.find({
        $or: [{ title: regex }, { description: regex }],
      })
        .select("title description image date time community")
        .populate("community", "name flagImage")
        .lean(),

      Community.find({
        $or: [{ name: regex }, { description: regex }, { language: regex }],
      })
        .select("name description flagImage language")
        .lean(),
    ]);

    const resultados = [
      ...negocios.map((n) => ({
        tipo: "negocio",
        id: n._id,
        nombre: n.nombre,
        descripcion: n.descripcion,
        categoria: n.categoria,
        imagen: n.featuredImage,
        comunidad: n.comunidad,
      })),
      ...eventos.map((e) => ({
        tipo: "evento",
        id: e._id,
        titulo: e.title,
        descripcion: e.description,
        fecha: e.date,
        hora: e.time,
        imagen: e.image,
        comunidad: e.community,
      })),
      ...comunidades.map((c) => ({
        tipo: "comunidad",
        id: c._id,
        nombre: c.name,
        descripcion: c.description,
        idioma: c.language,
        imagen: c.flagImage,
      })),
    ];

    res.json(resultados);
  } catch (error) {
    console.error("❌ Error en búsqueda global:", error);
    res.status(500).json({ error: "Error interno en búsqueda global" });
  }
});

export default router;
