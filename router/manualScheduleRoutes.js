// 📁 router/manualScheduleRoutes.js
import express from "express";
import {
  getManualSchedule,
  saveManualSchedule,
  updateCell,
} from "../controllers/manualScheduleController.js";

const router = express.Router();

router.get("/", getManualSchedule);
router.post("/", saveManualSchedule);
router.put("/cell", updateCell);

export default router;
