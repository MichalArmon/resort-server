import { Router } from "express";
import {
  // 🧘 אורחים (slug)
  getRoomByType,

  // 👩‍💼 אדמין (id)
  getRoomTypes,
  getRoomTypeById,
  createRoomType,
  updateRoomTypeById,
  deleteRoomTypeById,
} from "../controllers/roomController.js"; // ✅ שימי לב: roomsController.js (ברבים)

const router = Router();

/* ============================================================
   👩‍💼 Routes לאדמין — לפי ID
   ============================================================ */

// כל סוגי החדרים
router.get("/types", getRoomTypes);

// חדר בודד לפי ID (לעריכה באדמין)
router.get("/types/:id", getRoomTypeById);

// יצירת סוג חדר חדש
router.post("/types", createRoomType);

// עדכון לפי ID (הכי חשוב!)
router.put("/types/:id", updateRoomTypeById);

// מחיקה לפי ID
router.delete("/types/:id", deleteRoomTypeById);

/* ============================================================
   🧘 Routes לאורחים — לפי slug
   ============================================================ */
// לדוגמה: /api/v1/rooms/azurea
router.get("/:slug", getRoomByType);

export default router;
