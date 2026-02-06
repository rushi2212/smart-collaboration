import express from "express";
import {
  prioritizeTasksAI,
  agenticAnalysis,
} from "../controllers/ai.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/prioritize", authMiddleware, prioritizeTasksAI);
router.post("/agentic", authMiddleware, agenticAnalysis);

export default router;
