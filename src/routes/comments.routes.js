import express from "express";
import {
  createComment,
  getComments,
  deleteComment,
} from "../controllers/comments.controller.js";
import { authMiddleware } from "../middlewares/validateToken.js";

const router = express.Router();

router.post("/", authMiddleware, createComment);
router.get("/:targetType/:targetId", getComments);
router.delete("/:id", authMiddleware, deleteComment);

export default router;
