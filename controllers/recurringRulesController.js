// 📁 server/controllers/recurringRulesController.js
import RecurringRule from "../models/RecurringRule.js";
import moment from "moment";
import pkg from "rrule";
const { RRule } = pkg;

/* ===========================================================
   🟢 CREATE – יצירת חוק חוזר חדש עם בדיקת חפיפה
   ========================================================== */
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

    if (!workshopId || !studio || !startTime || !rrule || !effectiveFrom) {
      return res.status(400).json({
        error:
          "Missing required fields (workshopId, studio, startTime, rrule, effectiveFrom)",
      });
    }

    // זמן סיום
    const [h, m] = startTime.split(":").map(Number);
    const endTime = `${String(h + Math.floor((m + durationMin) / 60)).padStart(
      2,
      "0"
    )}:${String((m + durationMin) % 60).padStart(2, "0")}`;

    // חוקים קיימים באותו סטודיו
    const existing = await RecurringRule.find({
      studio,
      isActive: true,
      _id: { $ne: req.params?.id || null },
    });

    // יצירת RRULE לפי UTC בלבד
    let newRule;
    try {
      newRule = new RRule({
        ...RRule.parseString(rrule),
        dtstart: moment.utc(effectiveFrom).toDate(),
      });
    } catch {
      return res.status(400).json({ error: "Invalid RRULE format" });
    }

    // בדיקת חפיפה עם חוקים אחרים
    for (const rule of existing) {
      let other;
      try {
        other = new RRule({
          ...RRule.parseString(rule.rrule),
          dtstart: moment.utc(rule.effectiveFrom).toDate(),
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
          moment
            .utc(effectiveFrom)
            .isSameOrBefore(moment.utc(rule.effectiveTo)));

      if (overlap) {
        return res.status(400).json({
          error: `⛔ יש חפיפה עם חוק קיים באותו סטודיו (${studio})`,
        });
      }
    }

    const newDoc = await RecurringRule.create({
      ...req.body,
      timezone: "UTC",
      effectiveFrom: moment.utc(effectiveFrom).toDate(),
      effectiveTo: effectiveTo ? moment.utc(effectiveTo).toDate() : null,
    });

    res.status(201).json(newDoc);
  } catch (err) {
    console.error("❌ CREATE RULE ERROR:", err);
    res.status(400).json({ error: err.message });
  }
};

/* ===========================================================
   📖 READ – כל החוקים / לפי סדנה
   ========================================================== */
export const getRecurringRules = async (req, res) => {
  try {
    const { workshopId } = req.query;
    const rules = await RecurringRule.find(
      workshopId ? { workshopId } : {}
    ).populate("workshopId");

    // הצגה מקומית בלבד
    const localized = rules.map((r) => ({
      ...r._doc,
      effectiveFromLocal: moment
        .utc(r.effectiveFrom)
        .format("YYYY-MM-DD HH:mm"),
      effectiveToLocal: r.effectiveTo
        ? moment.utc(r.effectiveTo).format("YYYY-MM-DD HH:mm")
        : null,
    }));

    res.json(localized);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ===========================================================
   📘 READ – חוק אחד
   ========================================================== */
export const getRecurringRuleById = async (req, res) => {
  try {
    const rule = await RecurringRule.findById(req.params.id).populate(
      "workshopId"
    );
    if (!rule) return res.status(404).json({ error: "Rule not found" });

    res.json({
      ...rule._doc,
      effectiveFromLocal: moment
        .utc(rule.effectiveFrom)
        .format("YYYY-MM-DD HH:mm"),
      effectiveToLocal: rule.effectiveTo
        ? moment.utc(rule.effectiveTo).format("YYYY-MM-DD HH:mm")
        : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ===========================================================
   🛠️ UPDATE – עדכון חוק קיים עם בדיקת חפיפה מחדש
   ========================================================== */
export const updateRecurringRule = async (req, res) => {
  try {
    const ruleId = req.params.id;
    if (!ruleId)
      return res.status(400).json({ error: "Missing rule ID for update" });

    const {
      studio,
      startTime,
      durationMin = 60,
      rrule,
      effectiveFrom,
      effectiveTo,
    } = req.body;

    const [h, m] = startTime.split(":").map(Number);
    const endTime = `${String(h + Math.floor((m + durationMin) / 60)).padStart(
      2,
      "0"
    )}:${String((m + durationMin) % 60).padStart(2, "0")}`;

    const existing = await RecurringRule.find({
      studio,
      isActive: true,
      _id: { $ne: ruleId },
    });

    let newRule;
    try {
      newRule = new RRule({
        ...RRule.parseString(rrule),
        dtstart: moment.utc(effectiveFrom).toDate(),
      });
    } catch {
      return res.status(400).json({ error: "Invalid RRULE format" });
    }

    for (const rule of existing) {
      let other;
      try {
        other = new RRule({
          ...RRule.parseString(rule.rrule),
          dtstart: moment.utc(rule.effectiveFrom).toDate(),
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
          moment
            .utc(effectiveFrom)
            .isSameOrBefore(moment.utc(rule.effectiveTo)));

      if (overlap) {
        return res.status(400).json({
          error: `⛔ חפיפה בזמנים ב-${studio}.`,
        });
      }
    }

    const updated = await RecurringRule.findByIdAndUpdate(
      ruleId,
      {
        ...req.body,
        timezone: "UTC",
        effectiveFrom: moment.utc(effectiveFrom).toDate(),
        effectiveTo: effectiveTo ? moment.utc(effectiveTo).toDate() : null,
      },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: "Rule not found" });

    res.json(updated);
  } catch (err) {
    console.error("❌ UPDATE RULE ERROR:", err);
    res.status(400).json({ error: err.message });
  }
};

/* ===========================================================
   ❌ DELETE
   ========================================================== */
export const deleteRecurringRule = async (req, res) => {
  try {
    await RecurringRule.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
