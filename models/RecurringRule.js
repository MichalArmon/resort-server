// models/RecurringRule.js
import mongoose from "mongoose";
const { Schema, Types } = mongoose;

const RecurringRuleSchema = new Schema(
  {
    workshopId: { type: Types.ObjectId, ref: "Workshop", required: true },
    studio: {
      type: String,
      enum: ["Studio A", "Studio B"],
      default: "Studio A",
    },
    timezone: { type: String, default: "Asia/Jerusalem" }, // חשוב לטפל בשעון קיץ
    startTime: { type: String, required: true }, // "18:00" (HH:mm)
    durationMin: { type: Number, default: 60 },
    rrule: { type: String, required: true }, // לדוגמה: "FREQ=WEEKLY;BYDAY=MO,WE"
    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date, default: null }, // אם null – פתוח
    exceptions: [{ type: Date }], // תאריכים שבוטלו
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("RecurringRule", RecurringRuleSchema);
