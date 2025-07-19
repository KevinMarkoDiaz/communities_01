import EventView from "../models/eventView.model.js";
import mongoose from "mongoose";

/**
 * Registrar una visita a un evento
 */
export const registerEventView = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user ? req.user._id : null;
    const isAnonymous = !userId;

    // Para evitar registrar cada refresco, puedes chequear si hubo visita reciente
    const recentlyViewed = await EventView.findOne({
      event: eventId,
      viewer: userId,
      isAnonymous,
      viewedAt: { $gte: new Date(Date.now() - 1000 * 60 * 30) }, // 30 minutos
    });

    if (!recentlyViewed) {
      await EventView.create({
        event: eventId,
        viewer: userId,
        isAnonymous,
        viewedAt: new Date(),
        ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
        referrer: req.get("Referrer") || "",
      });
    }

    res.status(201).json({ message: "Visita registrada" });
  } catch (error) {
    console.error("Error al registrar visita:", error);
    res.status(500).json({ message: "Error al registrar visita" });
  }
};

/**
 * Obtener métricas totales de visitas
 */
export const getEventMetrics = async (req, res) => {
  try {
    const { eventId } = req.params;

    const totalViews = await EventView.countDocuments({ event: eventId });
    const anonymousViews = await EventView.countDocuments({
      event: eventId,
      isAnonymous: true,
    });
    const uniqueUsers = await EventView.distinct("viewer", {
      event: eventId,
      isAnonymous: false,
    });

    const lastVisitors = await EventView.find({
      event: eventId,
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
        ip: v.ip || "",
        referrer: v.referrer || "",
      })),
    });
  } catch (error) {
    console.error("Error obteniendo métricas:", error);
    res.status(500).json({ message: "Error obteniendo métricas" });
  }
};

/**
 * Obtener métricas filtradas por fecha
 */
export const getEventMetricsByDate = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        message: "Debes proporcionar startDate y endDate en el query",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const totalViews = await EventView.countDocuments({
      event: eventId,
      viewedAt: { $gte: start, $lte: end },
    });

    const anonymousViews = await EventView.countDocuments({
      event: eventId,
      isAnonymous: true,
      viewedAt: { $gte: start, $lte: end },
    });

    const uniqueUsers = await EventView.distinct("viewer", {
      event: eventId,
      isAnonymous: false,
      viewedAt: { $gte: start, $lte: end },
    });

    const lastVisitors = await EventView.find({
      event: eventId,
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
        ip: v.ip || "",
        referrer: v.referrer || "",
      })),
    });
  } catch (error) {
    console.error("Error obteniendo métricas filtradas:", error);
    res.status(500).json({ message: "Error obteniendo métricas filtradas" });
  }
};

/**
 * Visitas agrupadas por día
 */
export const getEventDailyViews = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        message: "Debes proporcionar startDate y endDate en el query",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const dailyViews = await EventView.aggregate([
      {
        $match: {
          event: new mongoose.Types.ObjectId(eventId),
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
export const getEventTopViewers = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { startDate, endDate, limit } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        message: "Debes proporcionar startDate y endDate en el query",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const topViewers = await EventView.aggregate([
      {
        $match: {
          event: new mongoose.Types.ObjectId(eventId),
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
      { $limit: parseInt(limit) || 10 },
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
 * Obtener todas las visitas detalladas por fecha (IP, referrer, etc.)
 *
 * ⚠️ En el futuro puedes usar un servicio de geolocalización (por ejemplo, ipapi.co o ipstack)
 *     para convertir la IP en ciudad/país y enriquecer esta información.
 */
export const getEventDetailedViews = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        message: "Debes proporcionar startDate y endDate en el query",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const views = await EventView.find({
      event: eventId,
      viewedAt: { $gte: start, $lte: end },
    })
      .sort({ viewedAt: -1 })
      .populate("viewer", "name email");

    res.status(200).json(
      views.map((v) => ({
        date: v.viewedAt,
        isAnonymous: v.isAnonymous,
        ip: v.ip || "",
        referrer: v.referrer || "",
        viewer: v.viewer
          ? {
              id: v.viewer._id,
              name: v.viewer.name,
              email: v.viewer.email,
            }
          : null,
      }))
    );
  } catch (error) {
    console.error("Error obteniendo visitas detalladas:", error);
    res.status(500).json({
      message: "Error obteniendo visitas detalladas",
    });
  }
};
