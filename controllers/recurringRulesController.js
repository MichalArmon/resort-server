import RecurringRule from "../models/RecurringRule.js";
import pkg from "rrule";
const { RRule } = pkg;

/* ===========================================================
   CREATE — עם בדיקת חפיפה
   =========================================================== */
export const createRecurringRule = async (req, res) => {
  try {
    const {
      workshopId,
      studio,
      startTime,
      durationMin,
      rrule,
      effectiveFrom,
      effectiveTo,
    } = req.body;

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

    // נגדיר את הכלל החדש
    const newRule = new RRule({
      ...RRule.parseString(rrule),
      dtstart: new Date(effectiveFrom),
    });

    // נבדוק חפיפה
    for (const rule of existing) {
      const other = new RRule({
        ...RRule.parseString(rule.rrule),
        dtstart: new Date(rule.effectiveFrom),
      });

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

    // אין חפיפה — ניצור
    const rule = await RecurringRule.create(req.body);
    res.status(201).json(rule);
  } catch (err) {
    res.status(400).json({ error: err.message });
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
    req.params.id && (req.body._id = req.params.id);
    await createRecurringRule(req, res); // משתמשים באותה לוגיקה כמו CREATE
  } catch (err) {
    res.status(400).json({ error: err.message });
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
