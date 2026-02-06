import express from "express";
import {
  createTask,
  getProjectTasks,
  updateTaskStatus,
  deleteTask,
} from "../controllers/task.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/", authMiddleware, createTask);
router.get("/:projectId", authMiddleware, getProjectTasks);
router.patch("/:id", authMiddleware, updateTaskStatus);
router.delete("/:id", authMiddleware, deleteTask);

export default router;
