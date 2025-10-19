// models/Retreat.js
import mongoose from "mongoose";

const { Schema, model, Types } = mongoose;

/* ---------- Activity (single row in a daily schedule) ---------- */
const ActivityItemSchema = new Schema(
  {
    time: {
      type: String,
      required: true,
      // HH:mm בפורמט 24 שעות
      match: [
        /^([01]\d|2[0-3]):([0-5]\d)$/,
        "time must be in HH:mm (24h) format",
      ],
    },
    title: { type: String, required: true, trim: true }, // "Morning Yoga"
    durationMin: { type: Number, min: 0 }, // e.g., 60
    location: { type: String, trim: true },
    notes: { type: String, trim: true },
    kind: {
      type: String,
      enum: ["class", "treatment", "meal", "break", "event", "note"],
      default: "note",
    },
    // Optional references to future models (not mandatory now)
    refId: { type: Types.ObjectId, refPath: "refModel" },
    refModel: { type: String, enum: ["Class", "Treatment"] },
  },
  { _id: true, timestamps: false }
);

/* ---------- Day in schedule ---------- */
const ScheduleDaySchema = new Schema(
  {
    date: { type: Date, required: true }, // start-of-day (local)
    activities: { type: [ActivityItemSchema], default: [] },
  },
  { _id: true, timestamps: false }
);

/* ---------- Retreat ---------- */
const retreatSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    type: {
      type: String,
      enum: ["Yoga", "Detox", "Skiing", "Cooking", "Other"],
      required: true,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },

    // Color for calendars/DatePicker
    color: { type: String, default: "#66bb6a" }, // HEX

    soldOut: { type: Boolean, default: false },
    participants: { type: [String], default: [] },

    isPrivate: { type: Boolean, default: true },
    isClosed: { type: Boolean, default: false },

    price: { type: Number, required: true },

    capacity: { type: Number },
    spotsLeft: { type: Number },

    // Display/content
    hero: String,
    gallery: [{ url: String, alt: String }],
    blurb: String,
    description: String,
    features: [String],

    // Daily schedule
    schedule: { type: [ScheduleDaySchema], default: [] },

    // Publishing
    published: { type: Boolean, default: true },
  },
  { timestamps: true }
);

/* ---------- Validation ---------- */
retreatSchema.pre("validate", function (next) {
  if (this.startDate && this.endDate && this.endDate < this.startDate) {
    return next(new Error("endDate must be on/after startDate"));
  }
  next();
});

/* ---------- Indexes ---------- */
retreatSchema.index({ startDate: 1, endDate: 1 });
retreatSchema.index({ type: 1, startDate: 1 });

/* ---------- Helpers: date utils ---------- */
function startOfDayLocal(dateLike) {
  const d = new Date(dateLike);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()); // local midnight
}
function datesBetweenInclusive(a, b) {
  const out = [];
  const cur = startOfDayLocal(a);
  const end = startOfDayLocal(b);
  while (cur <= end) {
    out.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/* ---------- Instance methods ---------- */

// Create skeleton schedule days for entire range if missing
retreatSchema.methods.ensureScheduleFrame = function () {
  if (!this.startDate || !this.endDate) return;
  const existingISO = new Set(
    (this.schedule || []).map((d) =>
      startOfDayLocal(d.date).toISOString().slice(0, 10)
    )
  );
  const needed = datesBetweenInclusive(this.startDate, this.endDate);
  for (const day of needed) {
    const iso = day.toISOString().slice(0, 10);
    if (!existingISO.has(iso)) {
      this.schedule.push({ date: day, activities: [] });
    }
  }
  // sort days ascending
  this.schedule.sort((a, b) => new Date(a.date) - new Date(b.date));
};

// Find a day subdoc by ISO (YYYY-MM-DD). If not exists and in range, create it.
retreatSchema.methods.getOrCreateDay = function (isoDate) {
  const dayDate = startOfDayLocal(isoDate);
  const inRange =
    dayDate >= startOfDayLocal(this.startDate) &&
    dayDate <= startOfDayLocal(this.endDate);
  if (!inRange) throw new Error("date is out of retreat range");

  const iso = dayDate.toISOString().slice(0, 10);
  let day = this.schedule.find(
    (d) => startOfDayLocal(d.date).toISOString().slice(0, 10) === iso
  );
  if (!day) {
    day = { date: dayDate, activities: [] };
    this.schedule.push(day);
    this.schedule.sort((a, b) => new Date(a.date) - new Date(b.date));
  }
  return day;
};

// Add activity to a given ISO date (YYYY-MM-DD)
retreatSchema.methods.addActivity = function (isoDate, payload) {
  const day = this.getOrCreateDay(isoDate);
  day.activities.push(payload);
  // sort activities by time (HH:mm lexical works)
  day.activities.sort((a, b) => a.time.localeCompare(b.time));
  return day;
};

// Update activity by dayId + activityId
retreatSchema.methods.updateActivity = function (dayId, activityId, patch) {
  const day = this.schedule.id(dayId);
  if (!day) throw new Error("day not found");
  const act = day.activities.id(activityId);
  if (!act) throw new Error("activity not found");
  Object.assign(act, patch);
  day.activities.sort((a, b) => a.time.localeCompare(b.time));
  return act;
};

// Remove activity by dayId + activityId
retreatSchema.methods.removeActivity = function (dayId, activityId) {
  const day = this.schedule.id(dayId);
  if (!day) throw new Error("day not found");
  const act = day.activities.id(activityId);
  if (!act) throw new Error("activity not found");
  act.deleteOne(); // remove subdoc
  return true;
};

// Public-friendly schedule payload for guests
retreatSchema.methods.toGuestSchedule = function () {
  // Return minimal, sorted structure
  const days = (this.schedule || [])
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((d) => ({
      iso: startOfDayLocal(d.date).toISOString().slice(0, 10),
      activities: (d.activities || [])
        .slice()
        .sort((a, b) => a.time.localeCompare(b.time))
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
  return {
    id: this._id,
    name: this.name,
    type: this.type,
    color: this.color,
    startDate: this.startDate,
    endDate: this.endDate,
    days,
  };
};

const Retreat = model("Retreat", retreatSchema);
export default Retreat;
