import express from "express";
import {
  getSessions,
  createSession,
  updateSession,
  deleteSession,
  updateCapacity,
  generateSessionsFromRules,
  getSessionAvailability, // ← חדש!
} from "../controllers/sessionController.js";

const router = express.Router();

/* ============================
   🧭 זמינות של סשן לפי ID
   ============================ */
router.get("/:id/availability", getSessionAvailability);

/* ============================
   CRUD בסיסי
   ============================ */
router.get("/", getSessions);
router.post("/", createSession);
router.put("/:id", updateSession);
router.delete("/:id", deleteSession);

/* ============================
   עדכון תפוסה
   ============================ */
router.patch("/:id/capacity", updateCapacity);

/* ============================
   יצירה אוטומטית מחוקים חוזרים
   ============================ */
router.post("/generate", generateSessionsFromRules);

export default router;
