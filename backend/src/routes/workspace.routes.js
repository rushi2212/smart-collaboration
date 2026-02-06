import express from "express";
import {
  createWorkspace,
  getUserWorkspaces,
  addMember,
  deleteWorkspace,
} from "../controllers/workspace.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/", authMiddleware, createWorkspace);
router.get("/", authMiddleware, getUserWorkspaces);
router.post("/:id/members", authMiddleware, addMember);
router.delete("/:id", authMiddleware, deleteWorkspace);

export default router;
