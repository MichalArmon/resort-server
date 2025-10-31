import RecurringRule from "../models/RecurringRule.js";
import pkg from "rrule";
const { RRule } = pkg;

/* ===========================================================
   CREATE — עם בדיקת חפיפה (כולל טיפול בשגיאות RRule)
   =========================================================== */
export const createRecurringRule = async (req, res) => {
  try {
    const {
      workshopId,
      studio,
      startTime,
      durationMin = 60,
      rrule,
      effectiveFrom,
      effectiveTo,
    } = req.body;

    // ✅ בדיקה בסיסית לשדות חובה
    if (!workshopId || !studio || !startTime || !rrule || !effectiveFrom) {
      return res.status(400).json({
        error:
          "Missing required fields (workshopId, studio, startTime, rrule, effectiveFrom)",
      });
    }

    // חישוב זמן סיום
    const [h, m] = startTime.split(":").map(Number);
    const endTime = `${String(h + Math.floor((m + durationMin) / 60)).padStart(
      2,
      "0"
    )}:${String((m + durationMin) % 60).padStart(2, "0")}`;

    // נאתר חוקים קיימים באותו סטודיו
    const existing = await RecurringRule.find({
      studio,
      isActive: true,
      _id: { $ne: req.params?.id || null },
    });

    // ננסה לפרש את הכלל החדש בצורה בטוחה
    let newRule;
    try {
      newRule = new RRule({
        ...RRule.parseString(rrule),
        dtstart: new Date(effectiveFrom),
      });
    } catch (e) {
      console.warn("⚠️ Invalid RRule syntax:", rrule);
      return res.status(400).json({ error: "Invalid recurrence rule format" });
    }

    // נבדוק חפיפה עם כל כלל קיים
    for (const rule of existing) {
      let other;
      try {
        other = new RRule({
          ...RRule.parseString(rule.rrule),
          dtstart: new Date(rule.effectiveFrom),
        });
      } catch (e) {
        console.warn(
          `⚠️ Skipping invalid existing rule (${rule._id}):`,
          e.message
        );
        continue;
      }

      // בדיקה אם יש ימים חופפים
      const sameDays = other.origOptions.byweekday?.some((d) =>
        newRule.origOptions.byweekday?.includes(d)
      );
      if (!sameDays) continue;

      // נחשב זמן סיום של החוק הקיים
      const [h2, m2] = rule.startTime.split(":").map(Number);
      const end2 = `${String(
        h2 + Math.floor((m2 + rule.durationMin) / 60)
      ).padStart(2, "0")}:${String((m2 + rule.durationMin) % 60).padStart(
        2,
        "0"
      )}`;

      const overlap =
        !(endTime <= rule.startTime || end2 <= startTime) &&
        (!effectiveTo ||
          !rule.effectiveTo ||
          new Date(effectiveFrom) <= rule.effectiveTo);

      if (overlap) {
        return res.status(400).json({
          error: `⛔ כבר יש חוג באותה שעה ב-${studio} (יום חופף לפי הכללים)`,
        });
      }
    }

    // ✅ אין חפיפה — ניצור את הכלל החדש
    const newDoc = await RecurringRule.create(req.body);
    console.log(`✅ New recurring rule created (${newDoc._id}) for ${studio}`);
    res.status(201).json(newDoc);
  } catch (err) {
    console.error("❌ CREATE RULE ERROR:", err);
    res
      .status(400)
      .json({ error: err.message || "Failed to create recurring rule" });
  }
};

/* ===========================================================
   READ (all for workshop)
   =========================================================== */
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

/* ===========================================================
   READ (single)
   =========================================================== */
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

/* ===========================================================
   UPDATE — כולל בדיקה מחדש לחפיפה
   =========================================================== */
export const updateRecurringRule = async (req, res) => {
  try {
    const {
      studio,
      startTime,
      durationMin = 60,
      rrule,
      effectiveFrom,
      effectiveTo,
    } = req.body;

    const ruleId = req.params.id;
    if (!ruleId) {
      return res.status(400).json({ error: "Missing rule ID for update" });
    }

    // חישוב זמן סיום
    const [h, m] = startTime.split(":").map(Number);
    const endTime = `${String(h + Math.floor((m + durationMin) / 60)).padStart(
      2,
      "0"
    )}:${String((m + durationMin) % 60).padStart(2, "0")}`;

    // נאתר חוקים קיימים באותו סטודיו (חוץ מהכלל הנוכחי)
    const existing = await RecurringRule.find({
      studio,
      isActive: true,
      _id: { $ne: ruleId },
    });

    let newRule;
    try {
      newRule = new RRule({
        ...RRule.parseString(rrule),
        dtstart: new Date(effectiveFrom),
      });
    } catch (e) {
      return res.status(400).json({ error: "Invalid recurrence rule format" });
    }

    // בדיקת חפיפה
    for (const rule of existing) {
      let other;
      try {
        other = new RRule({
          ...RRule.parseString(rule.rrule),
          dtstart: new Date(rule.effectiveFrom),
        });
      } catch {
        continue;
      }

      const sameDays = other.origOptions.byweekday?.some((d) =>
        newRule.origOptions.byweekday?.includes(d)
      );

      if (!sameDays) continue;

      const [h2, m2] = rule.startTime.split(":").map(Number);
      const end2 = `${String(
        h2 + Math.floor((m2 + rule.durationMin) / 60)
      ).padStart(2, "0")}:${String((m2 + rule.durationMin) % 60).padStart(
        2,
        "0"
      )}`;

      const overlap =
        !(endTime <= rule.startTime || end2 <= startTime) &&
        (!effectiveTo ||
          !rule.effectiveTo ||
          new Date(effectiveFrom) <= rule.effectiveTo);

      if (overlap) {
        return res.status(400).json({
          error: `⛔ A scheduling conflict was detected in ${studio} — another class occurs at the same time.`,
        });
      }
    }

    // ✅ אין חפיפה — נעדכן
    const updated = await RecurringRule.findByIdAndUpdate(ruleId, req.body, {
      new: true,
    });
    if (!updated) return res.status(404).json({ error: "Rule not found" });

    res.json(updated);
  } catch (err) {
    console.error("❌ UPDATE RULE ERROR:", err);
    res.status(400).json({ error: err.message || "Failed to update rule" });
  }
};

/* ===========================================================
   DELETE
   =========================================================== */
export const deleteRecurringRule = async (req, res) => {
  try {
    await RecurringRule.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
