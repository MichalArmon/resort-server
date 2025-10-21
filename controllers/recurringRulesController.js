// 📁 server/controllers/recurringRulesController.js
import RecurringRule from "../models/RecurringRule.js";
import pkg from "rrule";
const { RRule } = pkg;

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

/* ---------- GENERATE SESSIONS (with dtstart fix) ---------- */
export const generateSessions = async (req, res) => {
  try {
    const { ruleId, from, to } = req.query;
    if (!ruleId || !from || !to) {
      return res
        .status(400)
        .json({ error: "ruleId, from, and to parameters are required" });
    }

    const rule = await RecurringRule.findById(ruleId);
    if (!rule) return res.status(404).json({ error: "Rule not found" });

    // 🕒 קובעים מתי להתחיל: effectiveFrom + startTime
    const [hh, mm] = (rule.startTime || "00:00").split(":").map(Number);
    const ef = new Date(rule.effectiveFrom);
    const dtstart = new Date(ef);
    dtstart.setHours(hh ?? 0, mm ?? 0, 0, 0);

    // ממירים את מחרוזת ה־rrule לאובייקט עם dtstart ו־until (אם יש effectiveTo)
    const opts = RRule.parseString(rule.rrule);
    opts.dtstart = dtstart;
    if (rule.effectiveTo) {
      const until = new Date(rule.effectiveTo);
      until.setHours(23, 59, 59, 999);
      opts.until = until;
    }

    const r = new RRule(opts);

    // מחשבים תאריכים בין from ל־to
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const occurrences = r.between(fromDate, toDate, true); // includeStart=true

    // מסננים חריגים (exceptions)
    const excSet = new Set(
      (rule.exceptions || []).map((d) => new Date(d).toISOString().slice(0, 10))
    );

    const sessions = occurrences
      .filter((d) => !excSet.has(d.toISOString().slice(0, 10)))
      .map((start) => {
        const end = new Date(
          start.getTime() + (rule.durationMin || 60) * 60000
        );
        return { start, end };
      });

    res.json(sessions);
  } catch (err) {
    console.error("generateSessions error:", err);
    res.status(500).json({ error: err.message });
  }
};

/* ---------- UPDATE & DELETE ---------- */
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

export const deleteRecurringRule = async (req, res) => {
  try {
    await RecurringRule.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
