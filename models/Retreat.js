// models/Retreat.js
import mongoose from "mongoose";

const { Schema, model, Types } = mongoose;

// פריט בלוח הפעילויות
const ActivityItemSchema = new Schema(
  {
    time: { type: String, required: true }, // "09:00"
    title: { type: String, required: true }, // "Morning Yoga"
    durationMin: Number, // לדוגמה: 60
    location: String,
    notes: String,
    kind: {
      type: String,
      enum: ["class", "treatment", "note"],
      default: "note",
    },
    // הפניות עתידיות למודלים אחרים (לא חובה להשתמש עכשיו)
    refId: { type: Types.ObjectId, refPath: "refModel" },
    refModel: { type: String, enum: ["Class", "Treatment"] },
  },
  { _id: false }
);

// יום בלוח הפעילויות
const ScheduleDaySchema = new Schema(
  {
    date: { type: Date, required: true },
    activities: { type: [ActivityItemSchema], default: [] },
  },
  { _id: false }
);

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

    // חדש: צבע לצביעה ב-DatePicker (HEX)
    color: { type: String, default: "#66bb6a" },

    soldOut: { type: Boolean, default: false },
    participants: { type: [String], default: [] },

    isPrivate: { type: Boolean, default: true },
    isClosed: { type: Boolean, default: false },

    price: { type: Number, required: true },

    // חדש: קיבולת ומקומות שנותרו (לא חובה)
    capacity: { type: Number },
    spotsLeft: { type: Number },

    // חדש: שדות תצוגה ותוכן
    hero: String,
    gallery: [{ url: String, alt: String }],
    blurb: String,
    description: String,
    features: [String],

    // חדש: לוח פעילויות לפי ימים
    schedule: { type: [ScheduleDaySchema], default: [] },

    // חדש: פבלהשקות/פרסום
    published: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// ולידציה: endDate >= startDate
retreatSchema.pre("validate", function (next) {
  if (this.startDate && this.endDate && this.endDate < this.startDate) {
    return next(new Error("endDate must be on/after startDate"));
  }
  next();
});

// אינדקסים שימושיים
retreatSchema.index({ startDate: 1, endDate: 1 });
retreatSchema.index({ type: 1, startDate: 1 });

const Retreat = model("Retreat", retreatSchema);
export default Retreat;
