// 📁 server/router/roomsRoutes.js
import { Router } from "express";
import {
  getRoomBySlug,
  getRooms,
  getRoomById,
  createRoom,
  updateRoomById,
  deleteRoomById,
  checkAvailability, // ← הוספנו פה!
} from "../controllers/roomController.js"; // ← תיקון שם הקובץ

const router = Router();

/* ============================================================
   🧮 זמינות חדרים — לפי תאריכים
   ============================================================ */
// לדוגמה:
// /api/v1/rooms/availability?checkIn=2025-11-13&checkOut=2025-11-15&guests=2&rooms=1
router.get("/availability", checkAvailability);

/* ============================================================
   🧘 Routes לאורחים — לפי slug  (שימי לב לסדר!)
   ============================================================ */
router.get("/slug/:slug", getRoomBySlug);

/* ============================================================
   👩‍💼 Routes לאדמין — לפי ID
   ============================================================ */
router.get("/", getRooms);
router.get("/:id", getRoomById);
router.post("/", createRoom);
router.put("/:id", updateRoomById);
router.delete("/:id", deleteRoomById);

export default router;
