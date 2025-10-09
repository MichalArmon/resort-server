// routes/rooms.routes.js
import { Router } from "express";
import {
  getRoomTypes,
  getRoomByType /*, getRoomsListByType*/,
} from "../controllers/roomController.js";
import RoomType from "../models/Room.js";

const router = Router();

// /api/v1/rooms/types
router.get("/types", getRoomTypes);

// /api/v1/rooms/:type
router.get("/:type", getRoomByType);

// אם תרצי גם רשימה מלאה של חדרים בסוג:
// router.get("/:type/list", getRoomsListByType);
// === יצירת RoomType חדש ===
router.post("/types", async (req, res, next) => {
  try {
    const doc = await RoomType.create(req.body);
    res.status(201).json(doc);
  } catch (e) {
    console.error("❌ Error creating RoomType:", e.message);
    next(e);
  }
});

// === עדכון RoomType קיים לפי slug ===
router.put("/types/:slug", async (req, res, next) => {
  try {
    const { slug } = req.params;
    const doc = await RoomType.findOneAndUpdate({ slug }, req.body, {
      new: true,
      runValidators: true,
    });
    if (!doc)
      return res.status(404).json({ message: `RoomType '${slug}' not found` });
    res.json(doc);
  } catch (e) {
    console.error("❌ Error updating RoomType:", e.message);
    next(e);
  }
});

export default router;
