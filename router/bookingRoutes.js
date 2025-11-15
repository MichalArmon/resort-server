import { Router } from "express";
import {
  getQuote,
  cancelBooking,
  createBooking,
  getUsersBookings,
  getAllBookings,
  updateBooking,
} from "../controllers/bookingController.js";

const router = Router();

/* ===========================
   🧭 Public endpoints
   =========================== */

router.post("/quote", getQuote);
router.post("/", createBooking);

/* ===========================
   🔒 Admin / User endpoints
   =========================== */
// כל ההזמנות — לאדמין
router.get("/all", getAllBookings);

// ההזמנות של משתמש יחיד לפי אימייל או יוזר מחובר
router.get("/user", getUsersBookings);

// עדכון סטטוס (למשל Pending → Confirmed)
router.put("/:id", updateBooking);
router.patch("/:id/cancel", cancelBooking);

export default router;
