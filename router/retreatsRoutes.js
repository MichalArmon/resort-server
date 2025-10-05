import { Router } from "express";
import {
  getMonthlyRetreats,
  getCalendarDays,
  getRetreatById,
  createRetreat,
  updateRetreat,
  deleteRetreat,
} from "../controllers/retreatController.js";

const router = Router();

// מפת חודש (לצביעת לוח)
router.get("/monthly-map", getMonthlyRetreats);
router.get("/calendar", getCalendarDays);

// CRUD בסיסי (אופציונלי לפי צורך)
router.get("/:id", getRetreatById);
router.post("/", createRetreat);
router.patch("/:id", updateRetreat);
router.delete("/:id", deleteRetreat);

export default router;
