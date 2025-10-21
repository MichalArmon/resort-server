import RecurringRule from "../models/RecurringRule.js";
import Workshop from "../models/Workshop.js";
import pkg from "rrule";
const { RRule } = pkg;

const TZ = "Asia/Jerusalem";

// עוזר: מחזיר מחרוזות "YYYY-MM-DD" ו-"HH:00" לפי אזור זמן
function toLocalKeys(date) {
  // חלקים לוקאליים
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).map((p) => [p.type, p.value])
  );
  const dateKey = `${parts.year}-${parts.month}-${parts.day}`; // YYYY-MM-DD
  const hourKey = `${parts.hour}:00`; // HH:00
  return { dateKey, hourKey };
}

export const getSchedule = async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) {
      return res
        .status(400)
        .json({ error: "from and to query params are required (YYYY-MM-DD)" });
    }
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (isNaN(fromDate) || isNaN(toDate)) {
      return res.status(400).json({ error: "Invalid from/to dates" });
    }

    // נטען חוקים פעילים, יחד עם ה־Workshop (בשביל title)
    const rules = await RecurringRule.find({ isActive: true }).populate(
      "workshopId"
    );

    const rows = [];

    for (const rule of rules) {
      // dtstart = effectiveFrom + startTime
      const [hh, mm] = (rule.startTime || "00:00").split(":").map(Number);
      const ef = new Date(rule.effectiveFrom);
      const dtstart = new Date(ef);
      dtstart.setHours(hh ?? 0, mm ?? 0, 0, 0);

      const opts = RRule.parseString(rule.rrule);
      opts.dtstart = dtstart;
      if (rule.effectiveTo) {
        const until = new Date(rule.effectiveTo);
        until.setHours(23, 59, 59, 999);
        opts.until = until;
      }
      const r = new RRule(opts);

      const occurrences = r.between(fromDate, toDate, true);

      // Exceptions כפילטר לפי YYYY-MM-DD
      const excSet = new Set(
        (rule.exceptions || []).map((d) =>
          new Date(d).toISOString().slice(0, 10)
        )
      );

      for (const startUtc of occurrences) {
        const isoDay = startUtc.toISOString().slice(0, 10);
        if (excSet.has(isoDay)) continue;

        const endUtc = new Date(
          startUtc.getTime() + (rule.durationMin || 60) * 60000
        );

        const { dateKey, hourKey } = toLocalKeys(startUtc);

        rows.push({
          date: dateKey, // "2025-10-22"
          hour: hourKey, // "18:00"
          start: startUtc, // ISO
          end: endUtc, // ISO
          studio: rule.studio || "Unassigned",
          workshopId: rule.workshopId?._id,
          workshopTitle: rule.workshopId?.title || "(Untitled workshop)",
          ruleId: rule._id,
        });
      }
    }

    // מיון יציב
    rows.sort((a, b) =>
      (a.date + a.hour + a.studio).localeCompare(b.date + b.hour + b.studio)
    );

    res.json(rows);
  } catch (err) {
    console.error("getSchedule error:", err);
    res.status(500).json({ error: err.message });
  }
};
