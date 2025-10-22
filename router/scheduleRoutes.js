import express from "express";
import {
  // 🔹 אדמין – לוח שבועי (Grid CRUD)
  getManualSchedule,
  saveManualSchedule,
  updateCell,
  deleteManualSchedule,

  // 🔹 אורחים – לוח אמיתי לפי RRULE (read only)
  getSchedule,

  // 🔹 סשנים אמיתיים – לייב מהמסד
  materializeSessions,
  listSessions,
  deleteSessions,

  // 🔹 תאימות לאחור (אם יש עדיין קריאות ישנות)
  getGrid,
  saveGrid,
} from "../controllers/scheduleController.js";

const router = express.Router();

/* =====================================================
 *  🔹 אורחים: לוח אמיתי מטווח תאריכים
 * ===================================================== */
/**
 * GET /api/v1/schedule?from=2025-10-20&to=2025-10-26
 * מחזיר מערך של שיעורים בפועל (sessions לפי RRULE)
 */
router.get("/", getSchedule);

/* =====================================================
 *  🔹 אדמין: לוח שבועי (Grid)
 * ===================================================== */
/**
 * GET /api/v1/schedule/grid
 * מחזיר את הגריד השבועי לעריכה
 */
router.get("/grid", getManualSchedule);

/**
 * POST /api/v1/schedule/grid
 * שומר את כל הגריד השבועי
 */
router.post("/grid", saveManualSchedule);

/**
 * PUT /api/v1/schedule/grid/cell
 * עדכון תא בודד בתוך הגריד
 */
router.put("/grid/cell", updateCell);

/**
 * DELETE /api/v1/schedule/grid
 * מוחק את כל הלוח השבועי (אם רוצים רענון מלא)
 */
router.delete("/grid", deleteManualSchedule);

/* =====================================================
 *  🔹 Sessions אמיתיים (מבוססי RRULE)
 * ===================================================== */
/**
 * POST /api/v1/schedule/materialize
 * יוצר או מעדכן סשנים אמיתיים במסד
 */
router.post("/materialize", materializeSessions);

/**
 * GET /api/v1/schedule/sessions
 * מחזיר את רשימת הסשנים הקיימים
 */
router.get("/sessions", listSessions);

/**
 * DELETE /api/v1/schedule/sessions
 * מוחק סשנים לפי טווח תאריכים / חוג / סטודיו
 */
router.delete("/sessions", deleteSessions);

/* =====================================================
 *  🔹 תאימות לאחור (גרסה קודמת של ה-API)
 * ===================================================== */
router.get("/grid-legacy", getGrid);
router.post("/grid-legacy", saveGrid);

export default router;
