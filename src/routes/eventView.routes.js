import express from "express";
import {
  registerEventView,
  getEventMetrics,
  getEventMetricsByDate,
  getEventDailyViews,
  getEventTopViewers,
} from "../controllers/eventView.controller.js";
import { authMiddleware } from "../middlewares/validateToken.js";
import { getEventSummary } from "../controllers/event.controller.js";
import { hasRole } from "../middlewares/hasRole.js";

const router = express.Router();

router.post("/:eventId/views", (req, res, next) => {
  authMiddleware(req, res, () => {
    registerEventView(req, res);
  });
});
router.get(
  "/:eventId/summary",
  authMiddleware,
  hasRole("admin", "business_owner"),
  getEventSummary
);
router.get("/:eventId/metrics", authMiddleware, getEventMetrics);
router.get("/:eventId/metrics/filter", authMiddleware, getEventMetricsByDate);
router.get("/:eventId/metrics/daily", authMiddleware, getEventDailyViews);
router.get("/:eventId/metrics/top-viewers", authMiddleware, getEventTopViewers);

export default router;
