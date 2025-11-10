import express from "express";
import {
  getSessions,
  createSession,
  updateSession,
  deleteSession,
  updateCapacity,
  generateSessionsFromRules,
} from "../controllers/sessionController.js";

const router = express.Router();

router.get("/", getSessions);
router.post("/", createSession);
router.put("/:id", updateSession);
router.delete("/:id", deleteSession);
router.patch("/:id/capacity", updateCapacity);

// ✳️ כאן הקריאה ליצירת הסשנים האוטומטיים
router.post("/generate", generateSessionsFromRules);

export default router;
