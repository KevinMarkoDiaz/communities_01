import CommunityView from "../models/communityView.model.js";
import mongoose from "mongoose";

// Helpers
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const parseDateRange = (startDate, endDate) => {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

/**
 * Registrar visita a una comunidad
 */
export const registerCommunityView = async (req, res) => {
  try {
    const { communityId } = req.params;
    if (!isValidObjectId(communityId)) {
      return res.status(400).json({ message: "ID inválido de comunidad." });
    }

    const userId = req.user ? req.user._id : null;
    const isAnonymous = !userId;

    // Prevenir spam en 30 min
    const existing = await CommunityView.findOne({
      community: communityId,
      viewer: userId,
      isAnonymous,
      viewedAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) }, // Últimos 30 min
    });

    if (!existing) {
      await CommunityView.create({
        community: communityId,
        viewer: userId,
        isAnonymous,
      });
    }

    res.status(201).json({ message: "Visita registrada" });
  } catch (error) {
    console.error("❌ Error en registerCommunityView:", error);
    res.status(500).json({ message: "Error al registrar visita" });
  }
};

/**
 * Obtener métricas totales
 */
export const getCommunityMetrics = async (req, res) => {
  try {
    const { communityId } = req.params;
    if (!isValidObjectId(communityId)) {
      return res.status(400).json({ message: "ID de comunidad inválido" });
    }

    const [totalViews, anonymousViews, uniqueUsers, lastVisitors] =
      await Promise.all([
        CommunityView.countDocuments({ community: communityId }),
        CommunityView.countDocuments({
          community: communityId,
          isAnonymous: true,
        }),
        CommunityView.distinct("viewer", {
          community: communityId,
          isAnonymous: false,
        }),
        CommunityView.find({ community: communityId, isAnonymous: false })
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
    console.error("❌ Error en getCommunityMetrics:", error);
    res.status(500).json({ message: "Error obteniendo métricas" });
  }
};

/**
 * Métricas filtradas por rango de fechas
 */
export const getCommunityMetricsByDate = async (req, res) => {
  try {
    const { communityId } = req.params;
    const range = parseDateRange(req.query.startDate, req.query.endDate);
    if (!range) {
      return res
        .status(400)
        .json({ message: "Debes proporcionar startDate y endDate" });
    }

    const [totalViews, anonymousViews, uniqueUsers, lastVisitors] =
      await Promise.all([
        CommunityView.countDocuments({
          community: communityId,
          viewedAt: { $gte: range.start, $lte: range.end },
        }),
        CommunityView.countDocuments({
          community: communityId,
          isAnonymous: true,
          viewedAt: { $gte: range.start, $lte: range.end },
        }),
        CommunityView.distinct("viewer", {
          community: communityId,
          isAnonymous: false,
          viewedAt: { $gte: range.start, $lte: range.end },
        }),
        CommunityView.find({
          community: communityId,
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
    console.error("❌ Error en getCommunityMetricsByDate:", error);
    res.status(500).json({ message: "Error obteniendo métricas filtradas" });
  }
};

/**
 * Visitas agrupadas por día
 */
export const getCommunityDailyViews = async (req, res) => {
  try {
    const { communityId } = req.params;
    const range = parseDateRange(req.query.startDate, req.query.endDate);
    if (!range) {
      return res
        .status(400)
        .json({ message: "Debes proporcionar startDate y endDate" });
    }

    const dailyViews = await CommunityView.aggregate([
      {
        $match: {
          community: new mongoose.Types.ObjectId(communityId),
          viewedAt: { $gte: range.start, $lte: range.end },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$viewedAt" },
            month: { $month: "$viewedAt" },
            day: { $dayOfMonth: "$viewedAt" },
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
      count: d.count,
    }));

    res.status(200).json(result);
  } catch (error) {
    console.error("❌ Error en getCommunityDailyViews:", error);
    res.status(500).json({ message: "Error obteniendo visitas por día" });
  }
};

/**
 * Usuarios que más vieron la comunidad
 */
export const getCommunityTopViewers = async (req, res) => {
  try {
    const { communityId } = req.params;
    const range = parseDateRange(req.query.startDate, req.query.endDate);
    if (!range) {
      return res
        .status(400)
        .json({ message: "Debes proporcionar startDate y endDate" });
    }

    const parsedLimit = Math.max(parseInt(req.query.limit) || 10, 1);

    const topViewers = await CommunityView.aggregate([
      {
        $match: {
          community: new mongoose.Types.ObjectId(communityId),
          isAnonymous: false,
          viewedAt: { $gte: range.start, $lte: range.end },
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
    console.error("❌ Error en getCommunityTopViewers:", error);
    res.status(500).json({ message: "Error obteniendo ranking de usuarios" });
  }
};
