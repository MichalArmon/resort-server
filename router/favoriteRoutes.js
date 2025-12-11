// 📁 router/favoriteRoutes.js
import express from "express";
import {
  getUserFavorites,
  getUserFavoritesFull,
  toggleFavorite,
} from "../controllers/favoriteController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

/* ============================================================
 * ⭐ 1) GET USER FAVORITES — IDS ONLY
 * ============================================================ */
router.get("/:userId", protect, getUserFavorites);

/* ============================================================
 * ⭐ 2) GET USER FAVORITES — FULL OBJECTS
 * ============================================================ */
router.get("/:userId/full", protect, getUserFavoritesFull);

/* ============================================================
 * ⭐ 3) TOGGLE FAVORITE (LIKE / UNLIKE)
 * ============================================================ */
router.post("/toggle", protect, toggleFavorite);

export default router;
