// controllers/treatmentSessionController.js
import TreatmentSession from "../models/TreatmentSession.js";
import Treatment from "../models/Treatment.js";
import Booking from "../models/Booking.js";
import moment from "moment"; // ✅ את עובדת עם moment!

// שעות פעילות
const START_HOUR = 2;
const END_HOUR = 13;

/* ----------------------------------------------------
   helper: מקבל from–to ומחזיר מערך של תאריכים
---------------------------------------------------- */
const getDateRange = (from, to) => {
  const dates = [];

  let current = moment(from).startOf("day");
  const end = moment(to).endOf("day");

  while (current.isSameOrBefore(end)) {
    dates.push(current.clone().toDate());
    current.add(1, "day");
  }

  return dates;
};

/* ----------------------------------------------------
   helper: יוצר סלוטים לפי שעות ליום נתון
---------------------------------------------------- */
const buildSlotsForDate = (date) => {
  const slots = [];

  // שימי לב לשינוי כאן:  h < END_HOUR
  for (let h = START_HOUR; h < END_HOUR; h++) {
    const start = moment.utc(date).hour(h).minute(0).second(0).millisecond(0);
    const end = moment(start).add(1, "hour");

    slots.push({
      start: start.toDate(),
      end: end.toDate(),
    });
  }

  return slots;
};

/* ----------------------------------------------------
   1. יצירת סלוטים אוטומטית לטווח תאריכים או לחודש קדימה
---------------------------------------------------- */
export const generateTreatmentSessions = async (req, res) => {
  try {
    const { id } = req.params;

    // בדיקה שהטיפול קיים
    const treatment = await Treatment.findById(id);
    if (!treatment) {
      return res.status(404).json({ message: "Treatment not found" });
    }

    // 🟦 אם אין פרמטרים — הפקת סלוטים לחודש קדימה
    let { from, to } = req.query;

    if (!from || !to) {
      const start = moment().startOf("day");
      const end = moment().add(30, "days").endOf("day");

      from = start.format("YYYY-MM-DD");
      to = end.format("YYYY-MM-DD");
    }

    const dates = getDateRange(from, to);
    const sessionsToInsert = [];

    for (const date of dates) {
      const slots = buildSlotsForDate(date);

      slots.forEach(({ start, end }) => {
        sessionsToInsert.push({
          treatment: treatment._id,
          start,
          end,
        });
      });
    }

    // הכנסה עם דילוג על כפילויות
    await TreatmentSession.insertMany(sessionsToInsert, {
      ordered: false,
    }).catch((err) => {
      if (err.code !== 11000) throw err;
    });

    return res.json({
      ok: true,
      from,
      to,
      created: sessionsToInsert.length,
    });
  } catch (err) {
    console.error("generateTreatmentSessions error:", err);
    return res.status(500).json({ message: "Failed to generate sessions" });
  }
};

/* ----------------------------------------------------
   2. שליפת לו״ז
---------------------------------------------------- */
export const getTreatmentSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { from, to } = req.query;

    if (!from || !to) {
      return res
        .status(400)
        .json({ message: "from ו-to חובה בפורמט YYYY-MM-DD" });
    }

    const start = new Date(from);
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);

    const sessions = await TreatmentSession.find({
      treatment: id,
      start: { $gte: start, $lte: end },
    }).populate("bookedBy", "name email");

    return res.json(sessions);
  } catch (err) {
    console.error("getTreatmentSchedule error:", err);
    return res.status(500).json({ message: "Failed to fetch schedule" });
  }
};

/* ----------------------------------------------------
   3. הזמנת סלוט
---------------------------------------------------- */
export const bookTreatmentSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    const session = await TreatmentSession.findById(sessionId).populate(
      "treatment"
    );

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    if (session.isBooked) {
      return res.status(400).json({ message: "Session already booked" });
    }

    const booking = await Booking.create({
      user: userId,
      type: "treatment",
      treatment: session.treatment._id,
      start: session.start,
      end: session.end,
      status: "confirmed",
    });

    session.isBooked = true;
    session.bookedBy = userId;
    await session.save();

    return res.status(201).json({ session, booking });
  } catch (err) {
    console.error("bookTreatmentSession error:", err);
    return res.status(500).json({ message: "Failed to book session" });
  }
};
