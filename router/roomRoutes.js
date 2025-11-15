// 📁 server/router/roomsRoutes.js
import { Router } from "express";
import {
  getRoomBySlug,
  getRooms,
  getRoomById,
  createRoom,
  updateRoomById,
  deleteRoomById,
  getRoomAvailability,
} from "../controllers/roomController.js"; // ✅ שימי לב לשם הקובץ (roomsController.js)

const router = Router();

/* ============================================================
   🧮 זמינות חדרים — לפי תאריכים
   ============================================================ */
// לדוגמה: /api/v1/rooms/availability?checkIn=2025-11-13&checkOut=2025-11-15&room=ocean-breeze-suite
router.get("/availability", getRoomAvailability);
/* ============================================================
   👩‍💼 Routes לאדמין — לפי ID
   ============================================================ */
router.get("/", getRooms);
router.get("/:id", getRoomById);
router.post("/", createRoom);
router.put("/:id", updateRoomById);
router.delete("/:id", deleteRoomById);

/* ============================================================
   🧘 Routes לאורחים — לפי slug
   ============================================================ */
router.get("/slug/:slug", getRoomBySlug);

export default router;
