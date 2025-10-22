// ===== Controllers: Unified Schedule =====
// משלב: manual grid (Schedule) + occurrences מחוקי RRULE + Sessions (materialize/list)

import Schedule from "../models/Schedule.js";
import RecurringRule from "../models/RecurringRule.js";
import Session from "../models/Session.js";
import pkg from "rrule";
const { RRule } = pkg;

const TZ = "Asia/Jerusalem"; // מומלץ גם: process.env.TZ = "Asia/Jerusalem" בראש server.js

/* ---------- Helpers (TZ-safe) ---------- */

// מפתחי תאריך/שעה לוקאליים (YYYY-MM-DD, HH:00)
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
  const dateKey = `${parts.year}-${parts.month}-${parts.day}`;
  const hourKey = `${String(parts.hour).padStart(2, "0")}:00`;
  return { dateKey, hourKey };
}

// בונה Date לוקאלי
function buildLocalDateTime(dateStr, timeStr = "00:00") {
  const [h = "00", m = "00"] = String(timeStr).split(":");
  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  return new Date(`${dateStr}T${hh}:${mm}:00`);
}

// מחשב occurrences מחוקי RRULE
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
      continue;
    }

    const dtstart = buildLocalDateTime(
      rule.effectiveFrom,
      rule.startTime || "00:00"
    );
    opts.dtstart = dtstart;

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

  rows.sort((a, b) =>
    (a.date + a.hour + a.studio).localeCompare(b.date + b.hour + b.studio)
  );
  return rows;
}

/* ============================================================
 *  GUEST: GET /api/v1/schedule?from=YYYY-MM-DD&to=YYYY-MM-DD
 * ============================================================ */
export const getSchedule = async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) {
      return res
        .status(400)
        .json({ error: "from and to query params are required (YYYY-MM-DD)" });
    }

    const fromDate = buildLocalDateTime(from, "00:00");
    const toDate = buildLocalDateTime(to, "23:59");
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      return res.status(400).json({ error: "Invalid from/to dates" });
    }

    const rows = await buildOccurrences(from, to);
    res.json(rows);
  } catch (err) {
    console.error("getSchedule error:", err);
    res.status(500).json({ error: err.message });
  }
};

/* ============================================================
 *  ADMIN: Manual weekly grid (Schedule)
 * ============================================================ */

// GET grid
export const getManualSchedule = async (req, res) => {
  try {
    const { weekKey = "default" } = req.query;
    const doc = await Schedule.findOne({ weekKey });
    res.json(doc?.grid || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST full grid
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

// PUT one cell
export const updateCell = async (req, res) => {
  try {
    const { weekKey = "default", day, hour, studio, value } = req.body;
    if (!day || !hour || !studio) {
      return res.status(400).json({ error: "Missing params" });
    }

    const doc =
      (await Schedule.findOne({ weekKey })) ||
      new Schedule({ weekKey, grid: {} });

    if (!doc.grid[day]) doc.grid[day] = {};
    if (!doc.grid[day][hour]) doc.grid[day][hour] = {};
    doc.grid[day][hour][studio] = value;

    await doc.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ============================================================
 *  ADMIN: Sessions (materialize/list)
 * ============================================================ */
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

/* ============================================================
 *  🔹 ALIASES for backwards compatibility
 * ============================================================ */
export const getGrid = getManualSchedule;
export const saveGrid = saveManualSchedule;
