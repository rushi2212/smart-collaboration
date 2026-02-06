import express from "express";
import { sendMessage, getMessages } from "../controllers/chat.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/:projectId", authMiddleware, getMessages);
router.post("/", authMiddleware, sendMessage);

export default router;
