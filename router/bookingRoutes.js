import { Router } from "express";
import { protect, restrictTo } from "../middlewares/authMiddleware.js";
// 🛑 ייבוא פונקציות ה-Controller
import {
  checkAvailability,
  getQuote,
  createBooking,
  getUsersBookings, // 💡 נוסף
  getAllBookings, // 💡 נוסף
  updateBooking, // 💡 נוסף
} from "../controllers/bookingController.js";

const router = Router();

// 1. GET /api/bookings/availability
// מקבל תאריכים ומחזיר סיכום חדרים פנויים
router.get("/availability", checkAvailability);

// 2. POST /api/bookings/quote
// מקבל פרטי הזמנה ומחשב מחיר סופי
router.post("/quote", getQuote);

// 3. POST /api/bookings/book
// יוצר הזמנה חדשה בסטטוס Pending
router.post("/book", createBooking);

// ----------------------------------------------------
// ROUTES הדורשים אימות והרשאה
// ----------------------------------------------------

// 2. צפייה בהזמנות שלי: דורש רק להיות מחובר (user, guest, admin)
//    הפונקציה 'protect' תספיק כאן.
router.get("/my-bookings", protect, getUsersBookings);

// 3. צפייה בכל ההזמנות: מוגבל רק למנהלים ועובדים
//    דרושים: א. להיות מחובר. ב. להיות אחד מהתפקידים המורשים.
router.get(
  "/all-bookings",
  protect,
  restrictTo("admin", "employee"), // 🔑 ההגבלה על התפקידים
  getAllBookings
);

// 4. ניהול הזמנה (לדוגמה: ביטול/שינוי סטטוס): מוגבל למנהלים ועובדים
router.patch("/:id", protect, restrictTo("admin", "employee"), updateBooking);

export default router;
