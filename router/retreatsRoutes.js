// routes/retreats.js
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

const router = Router();

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

/* ---------- לוז יפה לאורח ---------- */
router.get("/:id/guest-schedule", getGuestSchedule);

export default router;
