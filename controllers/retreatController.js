// controllers/retreatController.js
import dayjs from "dayjs";
import Retreat from "../models/Retreat.js";

/* ---------- Helpers ---------- */

function eachDayISO(start, end) {
  const s = dayjs(start).startOf("day");
  const e = dayjs(end).startOf("day");
  const out = [];
  for (let d = s; !d.isAfter(e, "day"); d = d.add(1, "day")) {
    out.push(d.format("YYYY-MM-DD"));
  }
  return out;
}

// כשמשנים start/end – לוודא שלכל יום בטווח יש אובייקט schedule
function ensureScheduleDays(retreat) {
  if (!retreat?.startDate || !retreat?.endDate) return retreat;
  const wanted = new Set(eachDayISO(retreat.startDate, retreat.endDate));
  const current = new Map(
    (retreat.schedule || []).map((d) => [dayjs(d.date).format("YYYY-MM-DD"), d])
  );
  const merged = [...wanted].map(
    (iso) => current.get(iso) || { date: iso, activities: [] }
  );
  retreat.schedule = merged;
  return retreat;
}

/* ---------- Controllers ---------- */

/**
 * GET /api/v1/retreats/monthly-map?year=2025&month=10
 * מחזיר מפה של: { "2025-10-01": [{_id,name,color,type}], ... }
 * לשימוש ב-DatePicker לצביעה מהירה.
 */
export async function getMonthlyRetreats(req, res, next) {
  try {
    const year = Number(req.query.year) || dayjs().year();
    const month = Number(req.query.month) || dayjs().month() + 1; // 1-12

    const monthStart = dayjs(
      `${year}-${String(month).padStart(2, "0")}-01`
    ).startOf("month");
    const monthEnd = monthStart.endOf("month");

    const docs = await Retreat.find({
      published: true,
      startDate: { $lte: monthEnd.toDate() },
      endDate: { $gte: monthStart.toDate() },
    }).select("_id name type startDate endDate color price");

    const map = {};
    for (const r of docs) {
      const color = r.color || "#66bb6a";
      for (const iso of eachDayISO(r.startDate, r.endDate)) {
        if (!map[iso]) map[iso] = [];
        map[iso].push({
          _id: r._id,
          name: r.name,
          type: r.type,
          color,
          price: r.price,
        });
      }
    }
    res.json({ year, month, days: map });
  } catch (e) {
    next(e);
  }
}

/**
 * GET /api/v1/retreats/calendar?from=2025-10-01&to=2025-10-31
 * מחזיר מערך של ימים [{ date:"YYYY-MM-DD", items:[{_id,name,color,type}] }]
 * נוח ל־UI של לוח/רשימה.
 */
export async function getCalendarDays(req, res, next) {
  try {
    const from = req.query.from
      ? dayjs(req.query.from)
      : dayjs().startOf("month");
    const to = req.query.to ? dayjs(req.query.to) : from.endOf("month");

    const docs = await Retreat.find({
      published: true,
      startDate: { $lte: to.toDate() },
      endDate: { $gte: from.toDate() },
    }).select("_id name type startDate endDate color price");

    const map = new Map();
    for (const iso of eachDayISO(from, to)) map.set(iso, []);

    for (const r of docs) {
      const color = r.color || "#66bb6a";
      const inRangeDays = eachDayISO(
        dayjs.max(dayjs(r.startDate), from),
        dayjs.min(dayjs(r.endDate), to)
      );
      for (const iso of inRangeDays) {
        map.get(iso)?.push({
          _id: r._id,
          name: r.name,
          type: r.type,
          color,
          price: r.price,
        });
      }
    }

    const days = [...map.entries()].map(([date, items]) => ({ date, items }));
    res.json({
      from: from.format("YYYY-MM-DD"),
      to: to.format("YYYY-MM-DD"),
      days,
    });
  } catch (e) {
    next(e);
  }
}

/** GET /api/v1/retreats/:id */
export async function getRetreatById(req, res, next) {
  try {
    const doc = await Retreat.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Not found" });
    res.json(doc);
  } catch (e) {
    next(e);
  }
}

/** POST /api/v1/retreats */
export async function createRetreat(req, res, next) {
  try {
    const payload = req.body || {};
    ensureScheduleDays(payload); // יוצר/משלים ימים ריקים לפי הטווח
    const doc = await Retreat.create(payload);
    res.status(201).json(doc);
  } catch (e) {
    next(e);
  }
}

/** PATCH /api/v1/retreats/:id */
export async function updateRetreat(req, res, next) {
  try {
    const patch = req.body || {};
    // אם שינו startDate/endDate – נוודא שהלו״ז תואם לטווח החדש
    if (patch.startDate || patch.endDate) {
      const current = await Retreat.findById(req.params.id).select(
        "startDate endDate schedule"
      );
      if (!current) return res.status(404).json({ error: "Not found" });

      const merged = {
        ...current.toObject(),
        ...patch,
        schedule: patch.schedule ?? current.schedule,
      };
      ensureScheduleDays(merged);

      const updated = await Retreat.findByIdAndUpdate(req.params.id, merged, {
        new: true,
      });
      return res.json(updated);
    }

    // עדכון רגיל
    const updated = await Retreat.findByIdAndUpdate(req.params.id, patch, {
      new: true,
    });
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  } catch (e) {
    next(e);
  }
}

/** DELETE /api/v1/retreats/:id */
export async function deleteRetreat(req, res, next) {
  try {
    await Retreat.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}
