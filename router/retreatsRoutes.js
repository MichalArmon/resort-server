// 📁 routes/retreats.js
import { Router } from "express";
import {
  // קיימים
  getMonthlyRetreats,
  getCalendarDays,
  getRetreatById,
  createRetreat,
  updateRetreat,
  deleteRetreat,

  // חדשים (לו״ז)
  ensureSchedule,
  addActivity,
  updateActivity,
  removeActivity,
  getGuestSchedule,
} from "../controllers/retreatController.js";

import Retreat from "../models/Retreat.js"; // 👈 נוסיף שימוש ישיר למודל

const router = Router();

/* ---------- רשימות כלליות ---------- */
// GET /api/v1/retreats → כל הריטריטים שפורסמו
router.get("/", async (req, res, next) => {
  try {
    const docs = await Retreat.find({ published: true }).sort({ startDate: 1 });
    res.json(docs);
  } catch (e) {
    next(e);
  }
});

// GET /api/v1/retreats/upcoming → רק עתידיים
router.get("/upcoming", async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const docs = await Retreat.find({
      endDate: { $gte: today },
      published: true,
    }).sort({ startDate: 1 });
    res.json(docs);
  } catch (e) {
    next(e);
  }
});

/* ---------- מפת חודש (לצביעת לוח) ---------- */
router.get("/monthly-map", getMonthlyRetreats);
router.get("/calendar", getCalendarDays);

/* ---------- CRUD בסיסי ---------- */
router.get("/:id", getRetreatById);
router.post("/", createRetreat);
router.patch("/:id", updateRetreat);
router.delete("/:id", deleteRetreat);

/* ---------- ניהול לו״ז ---------- */
// משלים ימים חסרים לפי start/end
router.post("/:id/schedule/ensure", ensureSchedule);

// מוסיף פעילות ליום מסוים (iso=YYYY-MM-DD)
router.post("/:id/schedule/day/:iso/activities", addActivity);

// עדכון פעילות קיימת
router.put("/:id/schedule/:dayId/activities/:activityId", updateActivity);

// מחיקת פעילות
router.delete("/:id/schedule/:dayId/activities/:activityId", removeActivity);

/* ---------- לו״ז לאורח ---------- */
router.get("/:id/guest-schedule", getGuestSchedule);

export default router;
