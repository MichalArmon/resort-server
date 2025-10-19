// controllers/retreatController.js
import dayjs from "dayjs";
import Retreat from "../models/Retreat.js";

/* ---------- Helpers ---------- */

// יוצר מערך של תאריכים בין start ל-end בפורמט YYYY-MM-DD
function eachDayISO(start, end) {
  const s = dayjs(start).startOf("day");
  const e = dayjs(end).startOf("day");
  const out = [];
  for (let d = s; !d.isAfter(e, "day"); d = d.add(1, "day")) {
    out.push(d.format("YYYY-MM-DD"));
  }
  return out;
}

// משלים ימים ריקים בטווח התאריכים לפי startDate ו-endDate
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

// עוזרים נוספים
const ISO = (d) => dayjs(d).format("YYYY-MM-DD");
const isHHmm = (s) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(s || ""));
const sortByTime = (a, b) =>
  String(a.time || "").localeCompare(String(b.time || ""));

function getOrCreateDay(doc, iso) {
  const s = dayjs(doc.startDate).startOf("day");
  const e = dayjs(doc.endDate).startOf("day");
  const d = dayjs(iso, "YYYY-MM-DD", true);
  if (!d.isValid()) throw new Error("Bad ISO date");
  if (d.isBefore(s) || d.isAfter(e))
    throw new Error("date is out of retreat range");

  let day = (doc.schedule || []).find((x) => ISO(x.date) === iso);
  if (!day) {
    day = { date: iso, activities: [] };
    doc.schedule.push(day);
    doc.schedule.sort((a, b) => dayjs(a.date) - dayjs(b.date));
  }
  return day;
}

/* ---------- Controllers ---------- */

/** מפה חודשית לצביעה ב־DatePicker */
export async function getMonthlyRetreats(req, res, next) {
  try {
    const year = Number(req.query.year) || dayjs().year();
    const month = Number(req.query.month) || dayjs().month() + 1;
    const monthStart = dayjs(`${year}-${String(month).padStart(2, "0")}-01`);
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

/** לוח לפי טווח תאריכים */
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
    ensureScheduleDays(payload);
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

/* ============================================================
 *      ניהול לו"ז (ימים ופעילויות)
 * ============================================================ */

/** POST /api/v1/retreats/:id/schedule/ensure */
export async function ensureSchedule(req, res, next) {
  try {
    const doc = await Retreat.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Not found" });
    ensureScheduleDays(doc);
    await doc.save();
    res.json(doc.schedule);
  } catch (e) {
    next(e);
  }
}

/** POST /api/v1/retreats/:id/schedule/day/:iso/activities */
export async function addActivity(req, res, next) {
  try {
    const { id, iso } = req.params;
    const { time, title } = req.body || {};
    if (!isHHmm(time))
      return res.status(400).json({ error: "time must be HH:mm" });
    if (!title) return res.status(400).json({ error: "title is required" });

    const doc = await Retreat.findById(id);
    if (!doc) return res.status(404).json({ error: "Not found" });

    const day = getOrCreateDay(doc, iso);
    const payload = {
      time,
      title: String(title).trim(),
      durationMin: req.body.durationMin,
      location: req.body.location,
      notes: req.body.notes,
      kind: req.body.kind,
      refId: req.body.refId,
      refModel: req.body.refModel,
    };

    day.activities.push(payload);
    day.activities.sort(sortByTime);
    await doc.save();

    const fresh = (doc.schedule || []).find((x) => ISO(x.date) === iso);
    res.status(201).json(fresh);
  } catch (e) {
    next(e);
  }
}

/** PUT /api/v1/retreats/:id/schedule/:dayId/activities/:activityId */
export async function updateActivity(req, res, next) {
  try {
    const { id, dayId, activityId } = req.params;
    const patch = req.body || {};
    if (patch.time && !isHHmm(patch.time))
      return res.status(400).json({ error: "time must be HH:mm" });

    const doc = await Retreat.findById(id);
    if (!doc) return res.status(404).json({ error: "Not found" });

    const day = doc.schedule.id(dayId);
    if (!day) return res.status(404).json({ error: "day not found" });
    const act = day.activities.id(activityId);
    if (!act) return res.status(404).json({ error: "activity not found" });

    Object.assign(act, patch);
    day.activities.sort(sortByTime);
    await doc.save();
    res.json(act);
  } catch (e) {
    next(e);
  }
}

/** DELETE /api/v1/retreats/:id/schedule/:dayId/activities/:activityId */
export async function removeActivity(req, res, next) {
  try {
    const { id, dayId, activityId } = req.params;
    const doc = await Retreat.findById(id);
    if (!doc) return res.status(404).json({ error: "Not found" });

    const day = doc.schedule.id(dayId);
    if (!day) return res.status(404).json({ error: "day not found" });
    const act = day.activities.id(activityId);
    if (!act) return res.status(404).json({ error: "activity not found" });

    act.deleteOne();
    await doc.save();
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

/** GET /api/v1/retreats/:id/guest-schedule */
export async function getGuestSchedule(req, res, next) {
  try {
    const doc = await Retreat.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Not found" });

    const days = (doc.schedule || [])
      .slice()
      .sort((a, b) => dayjs(a.date) - dayjs(b.date))
      .map((d) => ({
        iso: ISO(d.date),
        activities: (d.activities || [])
          .slice()
          .sort(sortByTime)
          .map((a) => ({
            id: a._id,
            time: a.time,
            title: a.title,
            durationMin: a.durationMin,
            location: a.location,
            kind: a.kind,
            notes: a.notes,
          })),
      }));

    res.json({
      id: doc._id,
      name: doc.name,
      type: doc.type,
      color: doc.color,
      startDate: doc.startDate,
      endDate: doc.endDate,
      days,
    });
  } catch (e) {
    next(e);
  }
}
