// routes/astroRoutes.js
import express from "express";
import { protect } from "../controllers/authController.js";
import { getBirthChart } from "../controllers/astroController.js";

const router = express.Router();

router.use(protect);

// 🎯 מחזיר את ה־SVG למשתמש
router.get("/astro/birth-chart", getBirthChart);

export default router;
