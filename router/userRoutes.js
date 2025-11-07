import { Router } from "express";
import {
  registerUser,
  loginUser,
  getAllUsers,
  getUserById,
  deleteUser,
} from "../controllers/userController.js";

const router = Router();

// 🧭 Public routes
router.post("/register", registerUser);
router.post("/login", loginUser);

// 🔒 Admin routes
router.get("/", getAllUsers);
router.get("/:id", getUserById);
router.delete("/:id", deleteUser);

export default router;
