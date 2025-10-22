// 📘 controllers/scheduleController.js
// Unified Schedule Controller
// כולל:
//   - לוח אמיתי לאורחים (RRULE occurrences)
//   - לוח ידני לאדמין (Grid CRUD מלא)
//   - ניהול Sessions (חישוב, יצירה, שליפה)

// ============================================================
// Imports
// ============================================================
import Schedule from "../models/Schedule.js";
import RecurringRule from "../models/RecurringRule.js";
import Session from "../models/Session.js";
import pkg from "rrule";
const { RRule } = pkg;

const TZ = "Asia/Jerusalem"; // כבר מוגדר גם ב-server.js למניעת היסטים

// ============================================================
// Helpers
// ============================================================

// יוצר מזהה תאריך ושעה לוקאלי לפי Asia/Jerusalem
function toLocalKeys(date) {
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
  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    hourKey: `${String(parts.hour).padStart(2, "0")}:00`,
  };
}

// בונה אובייקט Date מקומי
function buildLocalDateTime(dateStr, timeStr = "00:00") {
  const [h = "00", m = "00"] = String(timeStr).split(":");
  return new Date(`${dateStr}T${h.padStart(2, "0")}:${m.padStart(2, "0")}:00`);
}

// מחשב Occurrences מתוך RecurringRule (לוח אמיתי)
async function buildOccurrences(from, to) {
  const fromDate = buildLocalDateTime(from, "00:00");
  const toDate = buildLocalDateTime(to, "23:59");

  const rules = await RecurringRule.find({ isActive: true }).populate(
    "workshopId"
  );
  const rows = [];

  for (const rule of rules) {
    let opts;
    try {
      opts = RRule.parseString(rule.rrule);
    } catch {
      continue; // כלל שבור – מתעלמים
    }

    opts.dtstart = buildLocalDateTime(
      rule.effectiveFrom,
      rule.startTime || "00:00"
    );
    if (rule.effectiveTo) {
      const until = buildLocalDateTime(rule.effectiveTo, "23:59");
      until.setSeconds(59, 999);
      opts.until = until;
    }

    const r = new RRule(opts);
    const occ = r.between(fromDate, toDate, true);
    const excSet = new Set((rule.exceptions || []).map((d) => d));

    for (const startLocal of occ) {
      const { dateKey, hourKey } = toLocalKeys(startLocal);
      if (excSet.has(dateKey)) continue;

      const durationMin = rule.durationMin > 0 ? rule.durationMin : 60;
      const endLocal = new Date(startLocal.getTime() + durationMin * 60000);

      rows.push({
        source: "recurring",
        date: dateKey,
        hour: hourKey,
        start: startLocal,
        end: endLocal,
        studio: rule.studio || "Unassigned",
        workshopId: rule.workshopId?._id || null,
        workshopSlug: rule.workshopId?.slug || null,
        workshopTitle: rule.workshopId?.title || "(Untitled workshop)",
        ruleId: rule._id,
      });
    }
  }

  return rows.sort((a, b) =>
    (a.date + a.hour + a.studio).localeCompare(b.date + b.hour + b.studio)
  );
}

// ============================================================
// GUEST: Schedule (read-only RRULE-based timeline)
// ============================================================

/**
 * GET /api/v1/schedule?from=YYYY-MM-DD&to=YYYY-MM-DD
 * מחזיר רשימת שיעורים בפועל לפי חוקים חוזרים
 */
export const getSchedule = async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to)
      return res
        .status(400)
        .json({ error: "from & to query params are required" });

    const rows = await buildOccurrences(from, to);
    res.json(rows);
  } catch (err) {
    console.error("getSchedule error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// ADMIN: Manual Weekly Grid CRUD
// ============================================================

/**
 * GET /api/v1/schedule/grid
 * טוען לוח ידני
 */
export const getManualSchedule = async (req, res) => {
  try {
    const { weekKey = "default" } = req.query;
    const doc = await Schedule.findOne({ weekKey });
    res.json(doc?.grid || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/v1/schedule/grid
 * יוצר / מעדכן את כל הגריד
 */
export const saveManualSchedule = async (req, res) => {
  try {
    const { weekKey = "default", grid } = req.body;
    if (!grid) return res.status(400).json({ error: "Missing grid" });

    const doc = await Schedule.findOneAndUpdate(
      { weekKey },
      { grid },
      { upsert: true, new: true }
    );
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * PUT /api/v1/schedule/grid/cell
 * מעדכן תא יחיד בלוח הידני
 */
export const updateCell = async (req, res) => {
  try {
    const { weekKey = "default", day, hour, studio, value } = req.body;
    if (!day || !hour || !studio)
      return res.status(400).json({ error: "Missing params" });

    const doc =
      (await Schedule.findOne({ weekKey })) ||
      new Schedule({ weekKey, grid: {} });
    doc.grid[day] = doc.grid[day] || {};
    doc.grid[day][hour] = doc.grid[day][hour] || {};
    doc.grid[day][hour][studio] = value;

    await doc.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * DELETE /api/v1/schedule/grid
 * מוחק לוח שבועי (אם נרצה ריק חדש)
 */
export const deleteManualSchedule = async (req, res) => {
  try {
    const { weekKey = "default" } = req.query;
    await Schedule.findOneAndDelete({ weekKey });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// ADMIN: Sessions (Generate / Read / Delete)
// ============================================================

/**
 * POST /api/v1/schedule/materialize?from&to
 * יוצר סשנים אמיתיים במסד מתוך RRULE
 */
export const materializeSessions = async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to)
      return res.status(400).json({ error: "from & to are required" });

    const occ = await buildOccurrences(from, to);
    let upserts = 0;

    for (const o of occ) {
      await Session.findOneAndUpdate(
        { workshopId: o.workshopId, studio: o.studio, start: o.start },
        {
          $set: {
            end: o.end,
            date: o.date,
            hour: o.hour,
            workshopSlug: o.workshopSlug,
            workshopTitle: o.workshopTitle,
            source: o.source,
            ruleId: o.ruleId || null,
            tz: TZ,
          },
        },
        { upsert: true, new: true }
      );
      upserts++;
    }

    res.json({ ok: true, upserts });
  } catch (err) {
    console.error("materializeSessions error:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/v1/schedule/sessions
 * מחזיר רשימת סשנים קיימים במסד
 */
export const listSessions = async (req, res) => {
  try {
    const { from, to, studio, workshopId } = req.query;
    const filter = {};

    if (from || to) {
      filter.start = {};
      if (from) filter.start.$gte = buildLocalDateTime(from, "00:00");
      if (to) filter.start.$lte = buildLocalDateTime(to, "23:59");
    }
    if (studio) filter.studio = studio;
    if (workshopId) filter.workshopId = workshopId;

    const items = await Session.find(filter).sort({ start: 1 }).lean();
    res.json({ count: items.length, items });
  } catch (err) {
    console.error("listSessions error:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * DELETE /api/v1/schedule/sessions
 * מוחק סשנים לפי טווח תאריכים / סטודיו / חוג
 */
export const deleteSessions = async (req, res) => {
  try {
    const { from, to, studio, workshopId } = req.query;
    const filter = {};

    if (from || to) {
      filter.start = {};
      if (from) filter.start.$gte = buildLocalDateTime(from, "00:00");
      if (to) filter.start.$lte = buildLocalDateTime(to, "23:59");
    }
    if (studio) filter.studio = studio;
    if (workshopId) filter.workshopId = workshopId;

    const result = await Session.deleteMany(filter);
    res.json({ ok: true, deletedCount: result.deletedCount });
  } catch (err) {
    console.error("deleteSessions error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// Backward Compatibility (אליאסים ישנים לגרסה קודמת)
// ============================================================
export const getGrid = getManualSchedule;
export const saveGrid = saveManualSchedule;
