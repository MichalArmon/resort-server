// 📁 routes/workshopsRoutes.js
import { Router } from "express";
import {
  listWorkshops,
  getWorkshop,
  getWorkshopById,
  createWorkshop,
  updateWorkshop,
  updateWorkshopById,
  deleteWorkshop,
} from "../controllers/workshopsController.js"; // שימי לב לשם הקובץ הנכון

const router = Router();

// אם יש לך מידלוורים לאדמין/אימות – הוסיפי כאן:
// import { requireAuth, requireAdmin } from "../middleware/auth.js";

/* ============================
   🧘 צד אורחים (Slug)
   ============================ */
router.get("/", listWorkshops);
router.get("/:slug", getWorkshop);

/* ============================
   ⚙️ צד אדמין (ID)
   ============================ */
// לאדמין – נשתמש ב-id כדי שאפשר יהיה לשנות slug חופשי
router.get("/id/:id", getWorkshopById);
router.put("/id/:id", updateWorkshopById);

/* ============================
   ✳️ יצירה ומחיקה
   ============================ */
router.post("/", createWorkshop);
router.put("/:slug", updateWorkshop); // השארנו תמיכה ב-slug כדי לא לשבור אורחים
router.delete("/:slug", deleteWorkshop);

export default router;
