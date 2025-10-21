import express from "express";
import { getSchedule } from "../controllers/scheduleController.js";

const router = express.Router();

/**
 * GET /api/v1/schedule?from=2025-10-20&to=2025-10-26
 * מחזיר מערך רשומות [{ date, hour, workshopTitle, studio, start, end, ... }]
 */
router.get("/", getSchedule);

export default router;
