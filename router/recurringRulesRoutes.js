// 📁 server/router/recurringRulesRoutes.js (מתוקן)
import express from "express";
import {
  createRecurringRule,
  getRecurringRules,
  updateRecurringRule,
  deleteRecurringRule, // 🎯 הסרנו את generateSessions מהייבוא // 🎯 נכלול את getRecurringRuleById שהוספנו בקונטרולר
  getRecurringRuleById,
} from "../controllers/recurringRulesController.js";

const router = express.Router();

router.post("/", createRecurringRule);
router.get("/", getRecurringRules);
router.get("/:id", getRecurringRuleById); // הוספת ראוט לשליפת כלל בודד

// ❌ הסרנו את הראוט הזה, החישוב נעשה כעת רק דרך /api/v1/schedule
// router.get("/sessions", generateSessions);

router.put("/:id", updateRecurringRule);
router.delete("/:id", deleteRecurringRule);

export default router;
