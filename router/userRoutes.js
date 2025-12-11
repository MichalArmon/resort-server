// routes/userRoutes.js
import { Router } from "express";
import {
  getAllUsers,
  getUserById,
  deleteUser,
  checkInUser,
  checkOutUser,
  updateAstroProfile,
} from "../controllers/userController.js";

import { protect } from "../controllers/authController.js";

const router = Router();

/* ============================================================
   🛡️ APPLY PROTECT TO ALL USER ROUTES
============================================================ */
router.use(protect);

/* ============================================================
   ⭐ USER UPDATES ASTRO PROFILE
============================================================ */
router.put("/me/astro-profile", updateAstroProfile);

/* ============================================================
   🔒 Admin routes
============================================================ */
router.get("/", getAllUsers);
router.get("/:id", getUserById);
router.delete("/:id", deleteUser);

/* ============================================================
   🟢 Inhouse routes (Admin only)
============================================================ */
router.patch("/checkin/:bookingId", checkInUser);
router.patch("/checkout/:bookingId", checkOutUser);

export default router;
