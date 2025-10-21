import { Router } from "express";
import {
  checkAvailability,
  getQuote,
  createBooking, // ← להחזיר!
  // getUsersBookings,
  // getAllBookings,
  // updateBooking,
} from "../controllers/bookingController.js";

const router = Router();

router.get("/availability", checkAvailability);
router.post("/quote", getQuote);

// ✅ זה הנתיב שנשתמש בו מהקליינט
router.post("/", createBooking);

// // אם מתעקשים גם על /book אפשר בנוסף:
// // router.post("/book", createBooking);

export default router;
