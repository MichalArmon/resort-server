import { Router } from "express";
import {
  checkAvailability,
  getQuote,
  createBooking,
  getUsersBookings,
  getAllBookings,
  updateBooking,
} from "../controllers/bookingController.js";

const router = Router();

/* ===========================
   🧭 Public endpoints
   =========================== */
router.get("/availability", checkAvailability);
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

export default router;
