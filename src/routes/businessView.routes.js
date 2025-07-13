import express from "express";
import {
  registerBusinessView,
  getBusinessMetrics,
  getBusinessMetricsByDate,
  getBusinessDailyViews,
  getBusinessTopViewers,
  getBusinessSummary,
} from "../controllers/businessView.controller.js";
import { authMiddleware } from "../middlewares/validateToken.js";
import { hasRole } from "../middlewares/hasRole.js";

const router = express.Router();

router.post("/:businessId/views", (req, res, next) => {
  authMiddleware(req, res, () => {
    registerBusinessView(req, res);
  });
});
// ✅ Nueva ruta: Obtener resumen de métricas
router.get(
  "/:businessId/summary",
  authMiddleware,
  hasRole("admin", "business_owner"),
  getBusinessSummary
);

router.get("/:businessId/metrics", authMiddleware, getBusinessMetrics);
router.get(
  "/:businessId/metrics/filter",
  authMiddleware,
  getBusinessMetricsByDate
);
router.get("/:businessId/metrics/daily", authMiddleware, getBusinessDailyViews);
router.get(
  "/:businessId/metrics/top-viewers",
  authMiddleware,
  getBusinessTopViewers
);

export default router;
