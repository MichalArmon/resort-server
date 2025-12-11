import { Router } from "express";
import {
  getQuote,
  cancelBooking,
  createBooking,
  getUsersBookings,
  getAllBookings,
  updateBooking,
} from "../controllers/bookingController.js";

import { protect, restrictTo } from "../controllers/authController.js";

const router = Router();

/* ===========================
   🧭 Public endpoints
   =========================== */

router.post("/quote", getQuote); // ציטוט מחיר — ציבורי

/* ===========================
   🔒 Protected endpoints
   =========================== */

// 🟣 יצירת בוקינג — רק למשתמש מחובר
router.post("/", protect, createBooking);

// 🟣 ההזמנות של המשתמש שמחובר
router.get("/user", protect, getUsersBookings);

/* ===========================
   🔐 Admin endpoints
   =========================== */

// 🛑 כל ההזמנות — רק אדמין
router.get("/all", protect, restrictTo("admin"), getAllBookings);

// 🛑 עדכון הזמנה — רק אדמין
router.put("/:id", protect, restrictTo("admin"), updateBooking);

// 🛑 ביטול — רק אדמין, או המשתמש שיצר את הבוקינג
router.patch("/:id/cancel", protect, cancelBooking);

export default router;
