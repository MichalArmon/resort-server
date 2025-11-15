// 📁 server/controllers/sessionController.js
import Session from "../models/Session.js";
import Workshop from "../models/Workshop.js";
import RecurringRule from "../models/RecurringRule.js";
import Booking from "../models/Booking.js";

import moment from "moment";

// ✅ פונקציה שמחזירה כמה אנשים באמת נרשמו לסשן
async function getBookedCount(sessionId) {
  try {
    return await Booking.countDocuments({ sessionId });
  } catch (e) {
    console.error("❌ getBookedCount failed:", e);
    return 0;
  }
}

/* ============================================================
   📅 GET – שליפת סשנים (עם פילטרים)
   ============================================================ */
/* ============================================================
   📅 GET – שליפת סשנים (עם פילטרים) + זמינות
   ============================================================ */
export const getSessions = async (req, res) => {
  try {
    const { start, end, studio, workshopId, status } = req.query;
    const filter = {};

    if (start && end)
      filter.start = {
        $gte: moment.utc(start).toDate(),
        $lte: moment.utc(end).toDate(),
      };

    if (studio) filter.studio = studio;
    if (workshopId) filter.workshopId = workshopId;
    if (status) filter.status = status;

    // 🟢 שליפה פשוטה
    const sessions = await Session.find(filter).sort({ start: 1 });

    // 🧠 החזרת נתונים עם לוקאליות + זמינות
    const enriched = await Promise.all(
      sessions.map(async (s) => {
        const startLocal = moment(s.start).format();
        const endLocal = moment(s.end).format();

        const capacity = s.capacity ?? 0;

        // ⭐ כאן זה עובד — await בתוך map async
        const bookedCount = await getBookedCount(s._id);

        const remaining = Math.max(0, capacity - bookedCount);
        const status = remaining > 0 ? "available" : "full";

        return {
          ...s._doc,
          startLocal,
          endLocal,
          capacity,
          bookedCount,
          remaining,
          status,
        };
      })
    );

    res.json(enriched);
  } catch (err) {
    console.error("❌ getSessions error:", err);
    res.status(500).json({ error: err.message });
  }
};

/* ============================================================
   ➕ POST – יצירת סשן ידני
   ============================================================ */
export const createSession = async (req, res) => {
  try {
    const {
      workshopId,
      start,
      end,
      studio,
      capacity,
      price,
      source = "manual",
    } = req.body;

    const workshop = await Workshop.findById(workshopId);
    if (!workshop) return res.status(404).json({ error: "Workshop not found" });

    const startMoment = moment(start);
    const startUtc = startMoment.clone().utc();
    const endUtc = end
      ? moment(end).clone().utc()
      : startUtc.clone().add(60, "minutes");

    const session = await Session.create({
      workshopId,
      start: startUtc.toDate(),
      end: endUtc.toDate(),
      studio: studio || workshop.studio || "Studio A",
      workshopName: workshop.title,
      workshopSlug: workshop.slug,
      dayOfWeek: startMoment.format("dddd"),
      capacity: capacity || workshop.capacity || 12,
      price: price || workshop.price || 0,
      date: startMoment.format("YYYY-MM-DD"),
      hour: startMoment.format("HH:mm"),
      source,
    });

    res.status(201).json(session);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

/* ============================================================
   🛠️ PUT – עדכון סשן
   ============================================================ */
export const updateSession = async (req, res) => {
  try {
    const session = await Session.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!session) return res.status(404).json({ error: "Session not found" });
    res.json(session);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

/* ============================================================
   ❌ DELETE – מחיקת סשן
   ============================================================ */
export const deleteSession = async (req, res) => {
  try {
    const session = await Session.findByIdAndDelete(req.params.id);
    if (!session) return res.status(404).json({ error: "Session not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ============================================================
   🔄 PATCH – עדכון תפוסה
   ============================================================ */
export const updateCapacity = async (req, res) => {
  try {
    const { bookedCount, capacity } = req.body;
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ error: "Session not found" });

    if (capacity !== undefined) session.capacity = capacity;
    if (bookedCount !== undefined) session.bookedCount = bookedCount;

    if (session.bookedCount >= session.capacity) session.status = "full";
    else if (session.status === "full") session.status = "scheduled";

    await session.save();
    res.json(session);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

/* ============================================================
   🪄 POST – ייצור סשנים אוטומטית מתוך חוקים חוזרים
   ============================================================ */
export const generateSessionsFromRules = async (req, res) => {
  try {
    const now = moment.utc().startOf("day");
    const until = moment.utc().add(1, "month").endOf("day");

    const rules = await RecurringRule.find({ isActive: true }).populate(
      "workshopId"
    );

    let createdCount = 0;
    const summary = {};

    for (const rule of rules) {
      const workshop = rule.workshopId;
      if (!workshop) continue;

      const from = moment.utc(rule.effectiveFrom || now);
      const to = rule.effectiveTo ? moment.utc(rule.effectiveTo) : until;

      const byDays =
        /BYDAY=([A-Z,]+)/.exec(rule.rrule || "")?.[1]?.split(",") || [];

      for (
        let current = from.clone();
        current.isSameOrBefore(to) && current.isSameOrBefore(until);
        current.add(1, "day")
      ) {
        const dayOfWeekCode = current.format("dd").toUpperCase().slice(0, 2);
        if (!byDays.includes(dayOfWeekCode)) continue;

        const startMoment = moment(
          `${current.format("YYYY-MM-DD")}T${rule.startTime}`
        );
        const startUtc = startMoment.clone().utc();
        const endUtc = startUtc.clone().add(rule.durationMin || 60, "minutes");

        const exists = await Session.exists({
          workshopId: workshop._id,
          studio: rule.studio,
          start: startUtc.toDate(),
        });
        if (exists) continue;

        await Session.create({
          workshopId: workshop._id,
          ruleId: rule._id,
          start: startUtc.toDate(),
          end: endUtc.toDate(),
          studio: rule.studio,
          date: startMoment.format("YYYY-MM-DD"),
          hour: startMoment.format("HH:mm"),
          dayOfWeek: startMoment.format("dddd"),
          workshopName: workshop.title,
          workshopSlug: workshop.slug,
          capacity: workshop.capacity || 12,
          price: rule.price || workshop.price || 0,
          bookedCount: 0,
          status: "scheduled",
          source: "recurring",
        });

        createdCount++;
        summary[workshop.title] = (summary[workshop.title] || 0) + 1;
      }
    }

    res.json({ success: true, createdCount, summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
/* ============================================================
   🎯 GET – זמינות של סשן יחיד לפי ID
   ------------------------------------------------------------
   GET /api/v1/sessions/:id/availability
   ============================================================ */
export const getSessionAvailability = async (req, res) => {
  try {
    const { id } = req.params;

    const session = await Session.findById(id);
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    const capacity = session.capacity ?? 0;
    const booked = session.bookedCount ?? session.booked ?? 0;
    const remaining = Math.max(0, capacity - booked);

    return res.json({
      sessionId: id,
      workshopId: session.workshopId,
      capacity,
      booked,
      remaining,
      status: remaining > 0 ? "available" : "full",
      start: session.start,
      end: session.end,
    });
  } catch (err) {
    console.error("❌ getSessionAvailability error:", err);
    res.status(500).json({
      message: "Failed to check session availability",
      error: err.message,
    });
  }
};
