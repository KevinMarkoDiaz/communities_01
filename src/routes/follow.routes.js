import express from "express";
import {
  createFollow,
  deleteFollow,
  listFollows,
} from "../controllers/follow.controller.js";
import { authMiddleware } from "../middlewares/validateToken.js";

const router = express.Router();

router.post("/", authMiddleware, createFollow);
router.delete("/", authMiddleware, deleteFollow);
router.get("/me/following", authMiddleware, listFollows);

export default router;
