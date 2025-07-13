import express from "express";
import {
  upsertRating,
  getAverageRating,
  getRatings,
} from "../controllers/ratings.controller.js";
import { authMiddleware } from "../middlewares/validateToken.js";

const router = express.Router();

router.post("/", authMiddleware, upsertRating);
router.get("/:targetType/:targetId/avg", getAverageRating);
router.get("/:targetType/:targetId", getRatings);

export default router;
