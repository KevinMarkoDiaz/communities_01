import express from "express";
import {
  registerEventView,
  getEventMetrics,
  getEventMetricsByDate,
  getEventDailyViews,
  getEventTopViewers,
  getEventDetailedViews, // ✅ Importar el nuevo controlador
} from "../controllers/eventView.controller.js";
import { authMiddleware } from "../middlewares/validateToken.js";
import { getEventSummary } from "../controllers/event.controller.js";
import { hasRole } from "../middlewares/hasRole.js";

const router = express.Router();

// Registrar una vista
router.post("/:eventId/views", (req, res, next) => {
  authMiddleware(req, res, () => {
    registerEventView(req, res);
  });
});

// Resumen general
router.get(
  "/:eventId/summary",
  authMiddleware,
  hasRole("admin", "business_owner"),
  getEventSummary
);

// Métricas generales
router.get("/:eventId/metrics", authMiddleware, getEventMetrics);

// Métricas filtradas por fechas
router.get("/:eventId/metrics/filter", authMiddleware, getEventMetricsByDate);

// Visitas agrupadas por día
router.get("/:eventId/metrics/daily", authMiddleware, getEventDailyViews);

// Top usuarios recurrentes
router.get("/:eventId/metrics/top-viewers", authMiddleware, getEventTopViewers);

// 🚀 Visitas detalladas con IP y referrer
// Útil para futuras métricas de geolocalización
router.get(
  "/:eventId/metrics/detailed-views",
  authMiddleware,
  hasRole("admin", "business_owner"),
  getEventDetailedViews
);

export default router;
