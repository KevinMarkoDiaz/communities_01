import BusinessView from "../models/businessView.model.js";
import Business from "../models/business.model.js";
import mongoose from "mongoose";
import Follow from "../models/follow.model.js";
import Rating from "../models/rating.model.js";
import Comment from "../models/comment.model.js";

// Utilidad para validar ObjectId
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// Utilidad para parsear rangos de fechas
const parseDateRange = (startDate, endDate) => {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

/**
 * Registrar una visita
 */
export const registerBusinessView = async (req, res) => {
  try {
    const { businessId } = req.params;
    if (!isValidObjectId(businessId)) {
      return res.status(400).json({ msg: "ID de negocio inválido" });
    }

    const negocio = await Business.findById(businessId).select("owner").lean();
    if (!negocio) {
      return res.status(404).json({ msg: "Negocio no encontrado" });
    }

    if (req.user && req.user._id.toString() === negocio.owner.toString()) {
      return res
        .status(200)
        .json({ msg: "Vista ignorada por ser el propietario." });
    }

    const view = new BusinessView({
      business: businessId,
      viewer: req.user ? req.user._id : null,
      isAnonymous: !req.user,
      viewedAt: new Date(),
      ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
      referrer: req.get("Referrer") || "",
    });

    await view.save();
    res.status(201).json({ msg: "Vista registrada correctamente." });
  } catch (error) {
    console.error("❌ Error en registerBusinessView:", error);
    res.status(500).json({ msg: "Error al registrar la vista" });
  }
};

/**
 * Obtener métricas totales
 */
export const getBusinessMetrics = async (req, res) => {
  try {
    const { businessId } = req.params;
    if (!isValidObjectId(businessId)) {
      return res.status(400).json({ msg: "ID de negocio inválido" });
    }

    const [totalViews, anonymousViews, uniqueUsers, lastVisitors] =
      await Promise.all([
        BusinessView.countDocuments({ business: businessId }),
        BusinessView.countDocuments({
          business: businessId,
          isAnonymous: true,
        }),
        BusinessView.distinct("viewer", {
          business: businessId,
          isAnonymous: false,
        }),
        BusinessView.find({ business: businessId, isAnonymous: false })
          .sort({ viewedAt: -1 })
          .limit(10)
          .populate("viewer", "name"),
      ]);

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
    console.error("❌ Error en getBusinessMetrics:", error);
    res.status(500).json({ message: "Error obteniendo métricas" });
  }
};

/**
 * Métricas filtradas por fecha
 */
export const getBusinessMetricsByDate = async (req, res) => {
  try {
    const { businessId } = req.params;
    const range = parseDateRange(req.query.startDate, req.query.endDate);
    if (!range)
      return res
        .status(400)
        .json({ message: "startDate y endDate requeridos" });

    const [totalViews, anonymousViews, uniqueUsers, lastVisitors] =
      await Promise.all([
        BusinessView.countDocuments({
          business: businessId,
          viewedAt: { $gte: range.start, $lte: range.end },
        }),
        BusinessView.countDocuments({
          business: businessId,
          isAnonymous: true,
          viewedAt: { $gte: range.start, $lte: range.end },
        }),
        BusinessView.distinct("viewer", {
          business: businessId,
          isAnonymous: false,
          viewedAt: { $gte: range.start, $lte: range.end },
        }),
        BusinessView.find({
          business: businessId,
          isAnonymous: false,
          viewedAt: { $gte: range.start, $lte: range.end },
        })
          .sort({ viewedAt: -1 })
          .limit(10)
          .populate("viewer", "name"),
      ]);

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
    console.error("❌ Error en getBusinessMetricsByDate:", error);
    res.status(500).json({ message: "Error obteniendo métricas filtradas" });
  }
};

/**
 * Visitas agrupadas por día y tipo
 */
export const getBusinessDailyViews = async (req, res) => {
  try {
    const { businessId } = req.params;
    const range = parseDateRange(req.query.startDate, req.query.endDate);
    if (!range)
      return res
        .status(400)
        .json({ message: "startDate y endDate requeridos" });

    const dailyViews = await BusinessView.aggregate([
      {
        $match: {
          business: new mongoose.Types.ObjectId(businessId),
          viewedAt: { $gte: range.start, $lte: range.end },
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
    console.error("❌ Error en getBusinessDailyViews:", error);
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

    const range = parseDateRange(startDate, endDate);
    if (!range)
      return res
        .status(400)
        .json({ message: "startDate y endDate requeridos" });

    const parsedLimit = Math.max(parseInt(limit) || 10, 1);

    const topViewers = await BusinessView.aggregate([
      {
        $match: {
          business: new mongoose.Types.ObjectId(businessId),
          isAnonymous: false,
          viewedAt: { $gte: range.start, $lte: range.end },
        },
      },
      { $group: { _id: "$viewer", count: { $sum: 1 } } },
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
    console.error("❌ Error en getBusinessTopViewers:", error);
    res.status(500).json({ message: "Error obteniendo ranking de usuarios" });
  }
};

/**
 * Resumen de seguidores, ratings y comentarios
 */
export const getBusinessSummary = async (req, res) => {
  try {
    const { businessId } = req.params;
    if (!isValidObjectId(businessId)) {
      return res.status(400).json({ msg: "ID de negocio inválido" });
    }

    const [followersCount, ratingsAgg, avgRatingAgg, commentsCount] =
      await Promise.all([
        Follow.countDocuments({
          entityId: new mongoose.Types.ObjectId(businessId),
          entityType: "business",
        }),
        Rating.aggregate([
          {
            $match: {
              targetId: new mongoose.Types.ObjectId(businessId),
              targetType: "business",
            },
          },
          { $group: { _id: "$value", count: { $sum: 1 } } },
        ]),
        Rating.aggregate([
          {
            $match: {
              targetId: new mongoose.Types.ObjectId(businessId),
              targetType: "business",
            },
          },
          { $group: { _id: null, avgRating: { $avg: "$value" } } },
        ]),
        Comment.countDocuments({
          targetId: new mongoose.Types.ObjectId(businessId),
          targetType: "business",
        }),
      ]);

    res.status(200).json({
      followersCount,
      ratings: ratingsAgg,
      averageRating: avgRatingAgg[0]?.avgRating || null,
      commentsCount,
    });
  } catch (error) {
    console.error("❌ Error en getBusinessSummary:", error);
    res.status(500).json({ msg: "Error al obtener resumen de métricas." });
  }
};

/**
 * Visitas con IPs
 */
export const getBusinessVisitsWithIPs = async (req, res) => {
  try {
    const { businessId } = req.params;
    const range = parseDateRange(req.query.startDate, req.query.endDate);
    if (!range)
      return res
        .status(400)
        .json({ message: "startDate y endDate requeridos" });

    const visits = await BusinessView.find({
      business: businessId,
      viewedAt: { $gte: range.start, $lte: range.end },
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
    console.error("❌ Error en getBusinessVisitsWithIPs:", error);
    res.status(500).json({ message: "Error al obtener visitas con IPs" });
  }
};
