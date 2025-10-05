// router/authRoutes.js - הראוטר בלבד!

import { Router } from "express";
// ייבוא הפונקציות מהקונטרולר
import {
  signup,
  login,
  googleAuth,
  guestLogin,
} from "../controllers/authController.js";

const router = Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/google", googleAuth);
router.post("/guest-login", guestLogin);

export default router;
