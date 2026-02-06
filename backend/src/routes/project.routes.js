import express from "express";
import {
  createProject,
  getWorkspaceProjects,
} from "../controllers/project.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/", authMiddleware, createProject);
router.get("/:workspaceId", authMiddleware, getWorkspaceProjects);

export default router;
