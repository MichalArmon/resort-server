import express from "express";
import {
  createRecurringRule,
  getRecurringRules,
  updateRecurringRule,
  deleteRecurringRule,
  generateSessions,
} from "../controllers/recurringRulesController.js";

const router = express.Router();

router.post("/", createRecurringRule);
router.get("/", getRecurringRules);
router.get("/sessions", generateSessions);
router.put("/:id", updateRecurringRule);
router.delete("/:id", deleteRecurringRule);

export default router;
