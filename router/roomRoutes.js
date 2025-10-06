// routes/rooms.routes.js
import { Router } from "express";
import {
  getRoomTypes,
  getRoomByType /*, getRoomsListByType*/,
} from "../controllers/rooms.controller.js";

const router = Router();

// /api/v1/rooms/types
router.get("/types", getRoomTypes);

// /api/v1/rooms/:type
router.get("/:type", getRoomByType);

// אם תרצי גם רשימה מלאה של חדרים בסוג:
// router.get("/:type/list", getRoomsListByType);

export default router;
