// 📁 models/RecurringRule.js
import mongoose from "mongoose";
const { Schema, Types } = mongoose;

/**
 * RecurringRule
 * ===============================
 * מגדיר את כלל ההישנות לסדנה אחת (Workshop)
 * ממנו נוצרים Sessions בפועל לפי ה־RRULE.
 *
 * כל החישובים נעשים לפי Asia/Bangkok
 * וכל התאריכים נשמרים ב־UTC.
 */

const RecurringRuleSchema = new Schema(
  {
    /* הסדנה שאליה שייך החוק */
    workshopId: { type: Types.ObjectId, ref: "Workshop", required: true },

    /* באיזה סטודיו זה קורה */
    studio: {
      type: String,
      enum: ["Studio A", "Studio B"],
      default: "Studio A",
    },

    /* אזור הזמן של החוק – תמיד תאילנד */
    timezone: {
      type: String,
      default: "Asia/Bangkok",
      immutable: true, // לא ניתן לשנות אחרי יצירה
    },

    /* שעת התחלה בפורמט "HH:mm" */
    startTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):([0-5]\d)$/, // ולידציה של שעה תקינה
    },

    /* משך הסדנה בדקות */
    durationMin: {
      type: Number,
      required: true,
      default: 60,
      min: 15,
      max: 600,
    },

    /* כלל הישנות בפורמט RFC5545 (RRULE) */
    rrule: {
      type: String,
      required: true,
      example: "FREQ=WEEKLY;BYDAY=MO,WE", // רק הסבר
    },

    /* תוקף הכלל */
    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date, default: null }, // אם null – נמשך ללא סוף

    /* תאריכים ספציפיים שבוטלו */
    exceptions: [{ type: Date }],

    /* האם החוק פעיל כרגע */
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

/* אינדקס שימושי – לכל סדנה לפי תוקף */
RecurringRuleSchema.index({ workshopId: 1, effectiveFrom: 1 });

export default mongoose.model("RecurringRule", RecurringRuleSchema);
