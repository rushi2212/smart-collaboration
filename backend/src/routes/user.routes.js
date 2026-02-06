import express from "express";
import { getAllUsers, getCurrentUser } from "../controllers/user.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", authMiddleware, getAllUsers);
router.get("/me", authMiddleware, getCurrentUser);

export default router;
