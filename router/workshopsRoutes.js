import { Router } from "express";
import {
  listWorkshops,
  getWorkshop,
  createWorkshop,
  updateWorkshop,
  deleteWorkshop,
} from "../controllers/workshopsController.js";

const router = Router();

// אם יש לך מידלוורים לאדמין/אימות – הוסיפי כאן:
// import { requireAuth, requireAdmin } from "../middleware/auth.js";

router.get("/", listWorkshops);
router.get("/:slug", getWorkshop);

// דוגמה לשילוב מידלוורים:
// router.post("/", requireAuth, requireAdmin, createWorkshop);
router.post("/", createWorkshop);

// router.put("/:slug", requireAuth, requireAdmin, updateWorkshop);
router.put("/:slug", updateWorkshop);

// router.delete("/:slug", requireAuth, requireAdmin, deleteWorkshop);
router.delete("/:slug", deleteWorkshop);

export default router;
