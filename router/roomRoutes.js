// 📁 server/router/roomsRoutes.js
import { Router } from "express";
import {
  // 🧘 אורחים (slug)
  getRoomBySlug,

  // 👩‍💼 אדמין (id)
  getRooms,
  getRoomById,
  createRoom,
  updateRoomById,
  deleteRoomById,
} from "../controllers/roomController.js";
const router = Router();

/* ============================================================
   👩‍💼 Routes לאדמין — לפי ID
   ============================================================ */

// כל החדרים
router.get("/", getRooms);

// חדר בודד לפי ID (לעריכה באדמין)
router.get("/:id", getRoomById);

// יצירת חדר חדש
router.post("/", createRoom);

// עדכון לפי ID (הכי חשוב!)
router.put("/:id", updateRoomById);

// מחיקה לפי ID
router.delete("/:id", deleteRoomById);

/* ============================================================
   🧘 Routes לאורחים — לפי slug
   ============================================================ */
// לדוגמה: /api/v1/rooms/azurea
router.get("/slug/:slug", getRoomBySlug);

export default router;
