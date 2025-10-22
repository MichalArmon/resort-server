// 📁 server/controllers/recurringRulesController.js
import RecurringRule from "../models/RecurringRule.js";
// ❌ הוסר: אין צורך ב-rrule בקונטרולר ה-CRUD
// import pkg from "rrule";
// const { RRule } = pkg;

/* ---------- CREATE ---------- */
export const createRecurringRule = async (req, res) => {
  try {
    const rule = await RecurringRule.create(req.body);
    res.status(201).json(rule);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

/* ---------- READ (all for workshop) ---------- */
export const getRecurringRules = async (req, res) => {
  try {
    const { workshopId } = req.query;
    const rules = await RecurringRule.find(
      workshopId ? { workshopId } : {}
    ).populate("workshopId");
    res.json(rules);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ---------- READ (single rule) ---------- */
export const getRecurringRuleById = async (req, res) => {
  try {
    const rule = await RecurringRule.findById(req.params.id).populate(
      "workshopId"
    );
    if (!rule) return res.status(404).json({ error: "Rule not found" });
    res.json(rule);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ❌ הוסר: הפונקציה generateSessions הוסרה לחלוטין.
// החישוב מתבצע כעת רק על ידי buildOccurrences ב-scheduleController.js.

/* ---------- UPDATE ---------- */
export const updateRecurringRule = async (req, res) => {
  try {
    const rule = await RecurringRule.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(rule);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

/* ---------- DELETE ---------- */
export const deleteRecurringRule = async (req, res) => {
  try {
    await RecurringRule.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
