import express from "express";
import {
  // 🔹 אדמין – לוח שבועי (Grid)
  getGrid, // גרסה חדשה של getManualSchedule
  saveGrid, // גרסה חדשה של saveManualSchedule
  updateCell,

  // 🔹 אורחים – לוח אמיתי לפי תאריכים
  getSchedule,

  // 🔹 אופציונלי – Sessions אמיתיים למסד
  materializeSessions,
  listSessions,
} from "../controllers/scheduleController.js";

const router = express.Router();

/* =====================================================
 *  🔹 אורחים: לוח אמיתי מטווח תאריכים
 * ===================================================== */
/**
 * GET /api/v1/schedule?from=2025-10-20&to=2025-10-26
 * מחזיר מערך של שיעורים בפועל (sessions)
 */
router.get("/", getSchedule);

/* =====================================================
 *  🔹 אדמין: לוח שבועי (Grid)
 * ===================================================== */
/**
 * GET /api/v1/schedule/grid
 * מחזיר את הגריד השבועי (לוח עריכה)
 */
router.get("/grid", getGrid);

/**
 * POST /api/v1/schedule/grid
 * שומר את כל הגריד השבועי
 */
router.post("/grid", saveGrid);

/**
 * PUT /api/v1/schedule/grid/cell
 * עדכון תא בודד בתוך הגריד
 */
router.put("/grid/cell", updateCell);

/* =====================================================
 *  🔹 אופציונלי: יצירת Sessions אמיתיים ממידע גריד
 * ===================================================== */
router.post("/materialize", materializeSessions);
router.get("/sessions", listSessions);

export default router;
