import BusinessView from "../models/businessView.model.js";
import Business from "../models/business.model.js";
import mongoose from "mongoose";
import Follow from "../models/follow.model.js";
import Rating from "../models/rating.model.js";
import Comment from "../models/comment.model.js";

/**
 * Registrar una visita
 */
export const registerBusinessView = async (req, res) => {
  try {
    const { businessId } = req.params;

    // 1. Verificar si el negocio existe
    const negocio = await Business.findById(businessId).select("owner");
    if (!negocio) {
      return res.status(404).json({ msg: "Negocio no encontrado" });
    }

    // 2. Ignorar si el visitante es el dueño
    if (req.user && req.user._id.toString() === negocio.owner.toString()) {
      console.log("👤 Visitante es el owner. No se registrará vista.");
      return res
        .status(200)
        .json({ msg: "Vista ignorada por ser el propietario." });
    }

    // 3. Registrar la vista
    const view = new BusinessView({
      business: businessId,
      viewer: req.user ? req.user._id : null,
      isAnonymous: !req.user,
      viewedAt: new Date(),
      ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
      referrer: req.get("Referrer") || "",
    });

    await view.save();

    console.log("✅ Vista registrada:", view._id);
    res.status(201).json({ msg: "Vista registrada correctamente." });
  } catch (error) {
    console.error("❌ Error al registrar vista:", error);
    res.status(500).json({ msg: "Error al registrar la vista" });
  }
};

/**
 * Obtener métricas totales
 */
export const getBusinessMetrics = async (req, res) => {
  try {
    const { businessId } = req.params;

    const totalViews = await BusinessView.countDocuments({
      business: businessId,
    });

    const anonymousViews = await BusinessView.countDocuments({
      business: businessId,
      isAnonymous: true,
    });

    const uniqueUsers = await BusinessView.distinct("viewer", {
      business: businessId,
      isAnonymous: false,
    });

    const lastVisitors = await BusinessView.find({
      business: businessId,
      isAnonymous: false,
    })
      .sort({ viewedAt: -1 })
      .limit(10)
      .populate("viewer", "name");

    res.status(200).json({
      totalViews,
      anonymousViews,
      uniqueLoggedInViews: uniqueUsers.length,
      lastVisitors: lastVisitors.map((v) => ({
        name: v.viewer?.name || "Desconocido",
        date: v.viewedAt,
      })),
    });
  } catch (error) {
    console.error("Error obteniendo métricas:", error);
    res.status(500).json({ message: "Error obteniendo métricas" });
  }
};

/**
 * Métricas filtradas por fecha
 */
export const getBusinessMetricsByDate = async (req, res) => {
  try {
    const { businessId } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        message: "Debes proporcionar startDate y endDate en el query",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const totalViews = await BusinessView.countDocuments({
      business: businessId,
      viewedAt: { $gte: start, $lte: end },
    });

    const anonymousViews = await BusinessView.countDocuments({
      business: businessId,
      isAnonymous: true,
      viewedAt: { $gte: start, $lte: end },
    });

    const uniqueUsers = await BusinessView.distinct("viewer", {
      business: businessId,
      isAnonymous: false,
      viewedAt: { $gte: start, $lte: end },
    });

    const lastVisitors = await BusinessView.find({
      business: businessId,
      isAnonymous: false,
      viewedAt: { $gte: start, $lte: end },
    })
      .sort({ viewedAt: -1 })
      .limit(10)
      .populate("viewer", "name");

    res.status(200).json({
      totalViews,
      anonymousViews,
      uniqueLoggedInViews: uniqueUsers.length,
      lastVisitors: lastVisitors.map((v) => ({
        name: v.viewer?.name || "Desconocido",
        date: v.viewedAt,
      })),
    });
  } catch (error) {
    console.error("Error obteniendo métricas filtradas:", error);
    res.status(500).json({ message: "Error obteniendo métricas filtradas" });
  }
};

/**
 * Visitas agrupadas por día y tipo
 */
export const getBusinessDailyViews = async (req, res) => {
  try {
    const { businessId } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        message: "Debes proporcionar startDate y endDate en el query",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const dailyViews = await BusinessView.aggregate([
      {
        $match: {
          business: new mongoose.Types.ObjectId(businessId),
          viewedAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$viewedAt" },
            month: { $month: "$viewedAt" },
            day: { $dayOfMonth: "$viewedAt" },
            isAnonymous: "$isAnonymous",
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    ]);

    const result = dailyViews.map((d) => ({
      date: `${d._id.year}-${String(d._id.month).padStart(2, "0")}-${String(
        d._id.day
      ).padStart(2, "0")}`,
      isAnonymous: d._id.isAnonymous,
      count: d.count,
    }));

    res.status(200).json(result);
  } catch (error) {
    console.error("Error obteniendo visitas por día:", error);
    res.status(500).json({ message: "Error obteniendo visitas por día" });
  }
};

/**
 * Ranking de usuarios recurrentes
 */
export const getBusinessTopViewers = async (req, res) => {
  try {
    const { businessId } = req.params;
    const { startDate, endDate, limit } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        message: "Debes proporcionar startDate y endDate en el query",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const parsedLimit = Math.max(parseInt(limit) || 10, 1);

    const topViewers = await BusinessView.aggregate([
      {
        $match: {
          business: new mongoose.Types.ObjectId(businessId),
          isAnonymous: false,
          viewedAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: "$viewer",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: parsedLimit },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $project: {
          _id: 0,
          name: "$user.name",
          visitCount: "$count",
        },
      },
    ]);

    res.status(200).json(topViewers);
  } catch (error) {
    console.error("Error obteniendo ranking de usuarios:", error);
    res.status(500).json({ message: "Error obteniendo ranking de usuarios" });
  }
};

/**
 * Resumen de seguidores, ratings y comentarios
 */
export const getBusinessSummary = async (req, res) => {
  const { businessId } = req.params;

  try {
    const followersCount = await Follow.countDocuments({
      entityId: new mongoose.Types.ObjectId(businessId),
      entityType: "business",
    });

    const ratingsAggregation = await Rating.aggregate([
      {
        $match: {
          targetId: new mongoose.Types.ObjectId(businessId),
          targetType: "business",
        },
      },
      {
        $group: {
          _id: "$value",
          count: { $sum: 1 },
        },
      },
    ]);

    const avgRatingResult = await Rating.aggregate([
      {
        $match: {
          targetId: new mongoose.Types.ObjectId(businessId),
          targetType: "business",
        },
      },
      {
        $group: {
          _id: null,
          avgRating: { $avg: "$value" },
        },
      },
    ]);

    const averageRating = avgRatingResult[0]?.avgRating || null;

    const commentsCount = await Comment.countDocuments({
      targetId: new mongoose.Types.ObjectId(businessId),
      targetType: "business",
    });

    res.status(200).json({
      followersCount,
      ratings: ratingsAggregation,
      averageRating,
      commentsCount,
    });
  } catch (error) {
    console.error("❌ Error en getBusinessSummary:", error);
    res.status(500).json({ msg: "Error al obtener resumen de métricas." });
  }
};

/**
 * Listar visitas con IPs en un rango de fechas
 */

/**
 * 🚀 NOTA DE IMPLEMENTACIÓN FUTURA:
 *
 * Este endpoint devuelve la IP de cada visita registrada.
 * Para poder ubicar geográficamente desde qué ciudad o país se realizaron las visitas,
 * será necesario integrar un servicio de geolocalización por IP (por ejemplo, ipinfo.io, ipstack o MaxMind).
 *
 * Flujo recomendado:
 * 1️⃣ Al registrar cada vista (en registerBusinessView), consultar la API de geolocalización con la IP.
 * 2️⃣ Guardar en el modelo los campos:
 *     - country
 *     - region
 *     - city
 *     - latitude
 *     - longitude
 * 3️⃣ Mostrar esta información en los reportes y métricas del negocio.
 *
 * Con esta base, se podrán generar estadísticas sobre la procedencia de las visitas.
 */

export const getBusinessVisitsWithIPs = async (req, res) => {
  try {
    const { businessId } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        message: "Debes proporcionar startDate y endDate en el query",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const visits = await BusinessView.find({
      business: businessId,
      viewedAt: { $gte: start, $lte: end },
    })
      .sort({ viewedAt: -1 })
      .populate("viewer", "name email");

    const result = visits.map((v) => ({
      date: v.viewedAt,
      ip: v.ip,
      isAnonymous: v.isAnonymous,
      viewer: v.viewer ? { name: v.viewer.name, email: v.viewer.email } : null,
    }));

    res.status(200).json(result);
  } catch (error) {
    console.error("Error obteniendo visitas con IPs:", error);
    res.status(500).json({
      message: "Error al obtener visitas con IPs",
    });
  }
};
