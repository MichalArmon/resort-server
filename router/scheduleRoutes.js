import express from "express";
import {
  // אדמין – לוח שבועי (grid)
  getManualSchedule, // ← יהיה getGrid
  saveManualSchedule, // ← יהיה saveGrid
  updateCell,

  // אורחים – לוח אמיתי לפי תאריכים
  getSchedule,

  // אופציונלי: יצירת Sessions למסד (אם רוצים לשמור אותם)
  materializeSessions,
  listSessions,
} from "../controllers/scheduleController.js";

const router = express.Router();

/* =====================================================
 *  🔹 אורחים: לוח אמיתי מטווח תאריכים
 * ===================================================== */
/**
 * GET /api/v1/schedule?from=2025-10-20&to=2025-10-26
 * מחזיר [{ date, hour, workshopTitle, studio, start, end, ... }]
 */
router.get("/", getSchedule);

/* =====================================================
 *  🔹 אדמין: גריד שבועי (ניהול ידני)
 * ===================================================== */
/**
 * GET /api/v1/schedule/grid
 * מחזיר את לוח השבועי לשימוש פנימי באדמין
 */
router.get("/grid", getManualSchedule);

/**
 * POST /api/v1/schedule/grid
 * שומר את הגריד השבועי (כולו)
 */
router.post("/grid", saveManualSchedule);

/**
 * PUT /api/v1/schedule/grid/cell
 * עדכון תא בודד (לא חובה – אפשר למחוק אם לא משתמשים בזה)
 */
router.put("/grid/cell", updateCell);

/* =====================================================
 *  🔹 אופציונלי: Sessions אמיתיים (שמירה למסד)
 * ===================================================== */
router.post("/materialize", materializeSessions);
router.get("/sessions", listSessions);

export default router;
