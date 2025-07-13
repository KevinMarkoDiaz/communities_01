import CommunityView from "../models/communityView.model.js";
import mongoose from "mongoose";

export const registerCommunityView = async (req, res) => {
  try {
    const { communityId } = req.params;

    const userId = req.user ? req.user._id : null;
    const isAnonymous = !userId;

    // Para evitar spam: buscar si en los últimos 30 min ya registró
    const existing = await CommunityView.findOne({
      community: communityId,
      viewer: userId,
      isAnonymous,
      viewedAt: { $gte: new Date(Date.now() - 1000 * 60 * 30) }, // 30 min
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
    console.error("Error al registrar visita:", error);
    res.status(500).json({ message: "Error al registrar visita" });
  }
};

export const getCommunityMetrics = async (req, res) => {
  try {
    const { communityId } = req.params;

    // Total de visitas
    const totalViews = await CommunityView.countDocuments({
      community: communityId,
    });

    // Total de visitas anónimas
    const anonymousViews = await CommunityView.countDocuments({
      community: communityId,
      isAnonymous: true,
    });

    // Usuarios únicos logueados
    const uniqueUsers = await CommunityView.distinct("viewer", {
      community: communityId,
      isAnonymous: false,
    });

    // Últimos 10 visitantes logueados
    const lastVisitors = await CommunityView.find({
      community: communityId,
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

export const getCommunityMetricsByDate = async (req, res) => {
  try {
    const { communityId } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        message: "Debes proporcionar startDate y endDate en el query",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // Incluye todo el día

    // Total de visitas en rango
    const totalViews = await CommunityView.countDocuments({
      community: communityId,
      viewedAt: { $gte: start, $lte: end },
    });

    // Visitas anónimas en rango
    const anonymousViews = await CommunityView.countDocuments({
      community: communityId,
      isAnonymous: true,
      viewedAt: { $gte: start, $lte: end },
    });

    // Usuarios únicos logueados en rango
    const uniqueUsers = await CommunityView.distinct("viewer", {
      community: communityId,
      isAnonymous: false,
      viewedAt: { $gte: start, $lte: end },
    });

    // Últimos visitantes logueados en rango
    const lastVisitors = await CommunityView.find({
      community: communityId,
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

export const getCommunityDailyViews = async (req, res) => {
  try {
    const { communityId } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        message: "Debes proporcionar startDate y endDate en el query",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const dailyViews = await CommunityView.aggregate([
      {
        $match: {
          community: new mongoose.Types.ObjectId(communityId),
          viewedAt: { $gte: start, $lte: end },
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
      {
        $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 },
      },
    ]);

    // Formatear la respuesta
    const result = dailyViews.map((d) => ({
      date: `${d._id.year}-${String(d._id.month).padStart(2, "0")}-${String(
        d._id.day
      ).padStart(2, "0")}`,
      count: d.count,
    }));

    res.status(200).json(result);
  } catch (error) {
    console.error("Error obteniendo visitas por día:", error);
    res.status(500).json({ message: "Error obteniendo visitas por día" });
  }
};

export const getCommunityTopViewers = async (req, res) => {
  try {
    const { communityId } = req.params;
    const { startDate, endDate, limit } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        message: "Debes proporcionar startDate y endDate en el query",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const topViewers = await CommunityView.aggregate([
      {
        $match: {
          community: new mongoose.Types.ObjectId(communityId),
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
      {
        $sort: { count: -1 },
      },
      {
        $limit: parseInt(limit) || 10,
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $unwind: "$user",
      },
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
