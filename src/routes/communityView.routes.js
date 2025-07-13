import express from "express";
import {
  registerCommunityView,
  getCommunityMetrics,
  getCommunityMetricsByDate,
  getCommunityDailyViews,
  getCommunityTopViewers,
} from "../controllers/communityView.controller.js";
import { authMiddleware } from "../middlewares/validateToken.js";
import { getCommunitySummary } from "../controllers/community.controller.js";
import { hasRole } from "../middlewares/hasRole.js";

const router = express.Router();

/**
 * Registrar visita (logueados y anónimos).
 * Si no hay token, req.user es undefined y se guarda como anónimo.
 */
router.post("/:communityId/views", (req, res, next) => {
  // Middleware opcional para inyectar user si hay token, sin bloquear si no hay
  authMiddleware(req, res, () => {
    registerCommunityView(req, res);
  });
});

router.get(
  "/:communityId/summary",
  authMiddleware,
  hasRole("admin", "business_owner"),
  getCommunitySummary
);
/**
 * Obtener métricas (solo logueados, puedes restringir a admin si prefieres)
 */
router.get("/:communityId/metrics", authMiddleware, getCommunityMetrics);

/**
 * Obtener métricas filtradas por fecha
 * Ejemplo: GET /api/community-views/:communityId/metrics/filter?startDate=2025-07-01&endDate=2025-07-12
 */
router.get(
  "/:communityId/metrics/filter",
  authMiddleware,
  getCommunityMetricsByDate
);

/**
 * Visitas agrupadas por día
 * Ejemplo: GET /api/community-views/:communityId/metrics/daily?startDate=2025-07-01&endDate=2025-07-12
 */
router.get(
  "/:communityId/metrics/daily",
  authMiddleware,
  getCommunityDailyViews
);

/**
 * Ranking de usuarios más recurrentes
 * Ejemplo: GET /api/community-views/:communityId/metrics/top-viewers?startDate=2025-07-01&endDate=2025-07-12&limit=5
 */
router.get(
  "/:communityId/metrics/top-viewers",
  authMiddleware,
  getCommunityTopViewers
);

export default router;
