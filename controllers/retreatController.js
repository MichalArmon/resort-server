import moment from "moment";
import Retreat from "../models/Retreat.js";
import slugify from "slugify";

/* ---------- Helpers ---------- */

function eachDayISO(start, end) {
  const s = moment(start).startOf("day");
  const e = moment(end).startOf("day");
  const out = [];
  for (let d = s.clone(); !d.isAfter(e, "day"); d.add(1, "day")) {
    out.push(d.format("YYYY-MM-DD"));
  }
  return out;
}

function ensureScheduleDays(retreat) {
  if (!retreat?.startDate || !retreat?.endDate) return retreat;
  const wanted = new Set(eachDayISO(retreat.startDate, retreat.endDate));
  const current = new Map(
    (retreat.schedule || []).map((d) => [
      moment(d.date).format("YYYY-MM-DD"),
      d,
    ])
  );
  const merged = [...wanted].map(
    (iso) => current.get(iso) || { date: iso, activities: [] }
  );
  retreat.schedule = merged;
  return retreat;
}

const ISO = (d) => moment(d).format("YYYY-MM-DD");
const isHHmm = (s) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(s || ""));
const sortByTime = (a, b) =>
  String(a.time || "").localeCompare(String(b.time || ""));

function getOrCreateDay(doc, iso) {
  const s = moment(doc.startDate).startOf("day");
  const e = moment(doc.endDate).startOf("day");
  const d = moment(iso, "YYYY-MM-DD", true);
  if (!d.isValid()) throw new Error("Bad ISO date");
  if (d.isBefore(s) || d.isAfter(e))
    throw new Error("date is out of retreat range");

  let day = (doc.schedule || []).find((x) => ISO(x.date) === iso);
  if (!day) {
    day = { date: iso, activities: [] };
    doc.schedule.push(day);
    doc.schedule.sort((a, b) => moment(a.date) - moment(b.date));
  }
  return day;
}

/* ============================================================
 *                      CONTROLLERS
 * ============================================================ */

/** 🗓 Monthly map for DatePicker coloring */
export async function getMonthlyRetreats(req, res, next) {
  try {
    const year = Number(req.query.year) || moment().year();
    const month = Number(req.query.month) || moment().month() + 1;
    const monthStart = moment(`${year}-${String(month).padStart(2, "0")}-01`);
    const monthEnd = monthStart.clone().endOf("month");

    const docs = await Retreat.find({
      published: true,
      startDate: { $lte: monthEnd.toDate() },
      endDate: { $gte: monthStart.toDate() },
    })
      .populate("category", "name color")
      .select("_id name type startDate endDate price category");

    const map = {};
    for (const r of docs) {
      const color = r.category?.color || "#66bb6a";
      for (const iso of eachDayISO(r.startDate, r.endDate)) {
        if (!map[iso]) map[iso] = [];
        map[iso].push({
          _id: r._id,
          name: r.name,
          type: r.type,
          color,
          category: r.category?.name,
          price: r.price,
        });
      }
    }

    res.json({ year, month, days: map });
  } catch (e) {
    next(e);
  }
}

/** 📅 Calendar range */
export async function getCalendarDays(req, res, next) {
  try {
    const from = req.query.from
      ? moment(req.query.from)
      : moment().startOf("month");
    const to = req.query.to
      ? moment(req.query.to)
      : from.clone().endOf("month");

    const docs = await Retreat.find({
      published: true,
      startDate: { $lte: to.toDate() },
      endDate: { $gte: from.toDate() },
    })
      .populate("category", "name color")
      .select("_id name type startDate endDate price category");

    const map = new Map();
    for (const iso of eachDayISO(from, to)) map.set(iso, []);

    for (const r of docs) {
      const color = r.category?.color || "#66bb6a";
      const inRangeDays = eachDayISO(
        moment.max(moment(r.startDate), from),
        moment.min(moment(r.endDate), to)
      );
      for (const iso of inRangeDays) {
        map.get(iso)?.push({
          _id: r._id,
          name: r.name,
          type: r.type,
          color,
          category: r.category?.name,
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

/** 🧘 Get retreat by ID (with category info) */
export async function getRetreatById(req, res, next) {
  try {
    const doc = await Retreat.findById(req.params.id).populate(
      "category",
      "name color types"
    );
    if (!doc) return res.status(404).json({ error: "Not found" });
    res.json(doc);
  } catch (e) {
    next(e);
  }
}

/** ➕ Create retreat */
export async function createRetreat(req, res, next) {
  try {
    const payload = req.body || {};
    if (payload.name && !payload.slug) {
      payload.slug = slugify(payload.name, { lower: true, strict: true });
    }

    const doc = await Retreat.create(payload);
    const populated = await doc.populate("category", "name color types");
    res.status(201).json(populated);
  } catch (e) {
    next(e);
  }
}

/** ✏️ Update retreat */
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
      }).populate("category", "name color types");
      return res.json(updated);
    }

    const updated = await Retreat.findByIdAndUpdate(req.params.id, patch, {
      new: true,
    }).populate("category", "name color types");

    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  } catch (e) {
    next(e);
  }
}

/** 🗑 Delete retreat */
export async function deleteRetreat(req, res, next) {
  try {
    await Retreat.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

/** 🔄 Ensure schedule completeness */
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

/* ============================================================
 *                      Activities
 * ============================================================ */

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

/** 🧘 Public schedule for guests */
export async function getGuestSchedule(req, res, next) {
  try {
    const doc = await Retreat.findById(req.params.id).populate(
      "category",
      "name color"
    );
    if (!doc) return res.status(404).json({ error: "Not found" });

    const days = (doc.schedule || [])
      .slice()
      .sort((a, b) => moment(a.date) - moment(b.date))
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
      category: doc.category,
      color: doc.category?.color || "#66bb6a",
      startDate: doc.startDate,
      endDate: doc.endDate,
      days,
    });
  } catch (e) {
    next(e);
  }
}
