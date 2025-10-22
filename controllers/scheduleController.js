// 📘 controllers/scheduleController.js (קוד מלא ומתוקן)
// Unified Schedule Controller
// כולל:
//   - לוח אמיתי לאורחים (RRULE occurrences + Manual Grid)
//   - לוח ידני לאדמין (Grid CRUD מלא)
//   - ניהול Sessions (חישוב, יצירה, שליפה)

// ============================================================
// Imports
// ============================================================
import Schedule from "../models/Schedule.js";
import RecurringRule from "../models/RecurringRule.js";
import Session from "../models/Session.js";
import Workshop from "../models/Workshop.js";
import pkg from "rrule";
const { RRule } = pkg;

// ============================================================
// Constants
// ============================================================
const TZ = "Asia/Jerusalem"; // כבר מוגדר גם ב-server.js למניעת היסטים

// Map Grid day keys to JS Date.getDay() (0=Sun, 1=Mon... 6=Sat)
const DAY_MAP = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

// ============================================================
// Helpers
// ============================================================

/**
 * בונה אובייקט Date מקומי (ב-Asia/Jerusalem) מתוך תאריך (YYYY-MM-DD) ושעה (HH:MM).
 */
function buildLocalDateTime(dateKey, timeKey = "00:00") {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [h, min] = timeKey.split(":").map(Number);
  const utcDate = new Date(Date.UTC(y, m - 1, d, h, min));
  return utcDate;
}

/**
 * יוצר מזהה תאריך ושעה לוקאלי (Asia/Jerusalem) לשימוש כמפתח.
 */
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

// ============================================================
// NEW: מחשב Occurrences מתוך הלוח הידני (Grid)
// ============================================================

async function buildGridOccurrences(from, to, weekKey = "default") {
  const fromDate = buildLocalDateTime(from, "00:00");
  const toDate = buildLocalDateTime(to, "23:59");
  const rows = []; // 🎯 תיקון: הסרת populate שהיה גורם לשגיאת 500

  const scheduleDoc = await Schedule.findOne({ weekKey });
  const grid = scheduleDoc?.grid || {};

  if (Object.keys(grid).length === 0) return rows;

  const today = new Date(fromDate);
  today.setHours(0, 0, 0, 0);
  const oneDay = 24 * 60 * 60 * 1000;

  while (today <= toDate) {
    const dayOfWeekLocal = today.getDay();
    const dayKey = Object.keys(DAY_MAP).find(
      (key) => DAY_MAP[key] === dayOfWeekLocal
    );
    const { dateKey } = toLocalKeys(today);

    if (dayKey && grid[dayKey]) {
      const daySchedule = grid[dayKey];

      for (const hourKey in daySchedule) {
        const studios = daySchedule[hourKey];

        for (const studioName in studios) {
          const workshopId = studios[studioName];
          if (!workshopId) continue;

          const workshop = await Workshop.findById(workshopId).lean();

          if (!workshop) {
            console.warn(
              `⚠️ Skipping manual session: Workshop ID ${workshopId} not found in DB.`
            );
            continue;
          }

          const startLocal = buildLocalDateTime(dateKey, hourKey);
          const durationMin =
            workshop?.durationMin > 0 ? workshop.durationMin : 60;
          const endLocal = new Date(startLocal.getTime() + durationMin * 60000);

          rows.push({
            source: "manual",
            date: dateKey,
            hour: hourKey,
            start: startLocal,
            end: endLocal,
            studio: studioName,
            workshopId: workshop._id,
            workshopSlug: workshop.slug || null,
            workshopTitle: workshop.title || `Manual Session - ${workshopId}`,
            ruleId: null,
          });
        }
      }
    }
    today.setTime(today.getTime() + oneDay);
  }
  return rows;
}

// ============================================================
// REFACTORED: מחשב Occurrences מתוך RecurringRule בלבד
// ============================================================

async function buildRRuleOccurrences(from, to) {
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
    } catch (e) {
      console.warn(
        `⚠️ Skipping rule ${rule._id}: invalid RRule string. Error: ${e.message}`
      );
      continue;
    }

    let dtstart = new Date();
    if (rule.effectiveFrom) {
      const maybe = buildLocalDateTime(
        rule.effectiveFrom,
        rule.startTime || "00:00"
      );
      if (!isNaN(maybe.getTime())) dtstart = maybe;
    }

    if (dtstart instanceof Date && !isNaN(dtstart.getTime())) {
      opts.dtstart = dtstart;
    } else {
      console.warn(
        `⚠️ Skipping rule ${rule._id}: invalid dtstart/effectiveFrom`
      );
      continue;
    }

    if (rule.effectiveTo) {
      const until = buildLocalDateTime(rule.effectiveTo, "23:59");
      until.setSeconds(59, 999);
      opts.until = until;
    }

    opts.tzid = TZ;

    let r;
    try {
      r = new RRule(opts);
    } catch (e) {
      console.warn(
        `⚠️ Skipping rule ${rule._id}: RRule construction error. Error: ${e.message}`
      );
      continue;
    }

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
  return rows;
}

// ============================================================
// NEW: הפונקציה המאוחדת שמחברת את הכל
// ============================================================

async function buildOccurrences(from, to) {
  const rruleOccurrences = await buildRRuleOccurrences(from, to);
  const gridOccurrences = await buildGridOccurrences(from, to);
  let allOccurrences = [...rruleOccurrences, ...gridOccurrences];

  return allOccurrences.sort(
    (a, b) =>
      a.start.getTime() - b.start.getTime() || a.studio.localeCompare(b.studio)
  );
}

// ============================================================
// GUEST: Schedule (read-only RRULE-based timeline)
// ============================================================

/**
 * GET /api/v1/schedule?from=YYYY-MM-DD&to=YYYY-MM-DD
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
 */
export const deleteManualSchedule = async (req, res) => {
  try {
    const { weekKey = "default" } = req.query;
    await Schedule.findOneAndDelete({ weekKey });
    res.json({ success: true });
  } catch (err) {
    console.error("deleteManualSchedule error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// ADMIN: Sessions (Generate / Read / Delete)
// ============================================================

/**
 * POST /api/v1/schedule/materialize?from&to
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
