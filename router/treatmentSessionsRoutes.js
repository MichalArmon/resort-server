// routes/treatmentSessionsRoutes.js
import express from "express";
import {
  generateTreatmentSessions,
  getTreatmentSchedule,
  bookTreatmentSession,
} from "../controllers/treatmentSessionController.js";
import { protect, restrictTo } from "../controllers/authController.js";

const router = express.Router();

// יצירת סלוטים ע״י אדמין
router.post(
  "/treatments/:id/sessions/generate",
  protect,
  restrictTo("admin"),
  generateTreatmentSessions
);

// שליפת לו״ז לטיפול
router.get("/treatments/:id/sessions", getTreatmentSchedule);

// בוקינג לסשן
router.post(
  "/treatments/sessions/:sessionId/book",
  protect,
  bookTreatmentSession
);

export default router;
