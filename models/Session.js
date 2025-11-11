// 📁 models/Session.js
import mongoose from "mongoose";
const { Schema, Types } = mongoose;

/**
 * Session
 * ===============================
 * מייצג מופע יחיד בפועל של סדנה (Workshop)
 * שנוצר מחוק חוזר (RecurringRule).
 *
 * ⏱️ כל השדות נשמרים ב־UTC
 * 🌏 ומפורשים כלוגית לפי Asia/Bangkok בתצוגה בלבד.
 */

const SessionSchema = new Schema(
  {
    /* הקשר לסדנה */
    workshopId: {
      type: Types.ObjectId,
      ref: "Workshop",
      required: true,
    },

    /* שם הסדנה לקריאות בלבד (נשמר בזמן יצירה) */
    workshopName: {
      type: String,
      default: "",
    },

    /* החוק שממנו נוצר הסשן */
    ruleId: {
      type: Types.ObjectId,
      ref: "RecurringRule",
      required: false,
    },

    /* זמן התחלה (UTC) */
    start: { type: Date, required: true },

    /* זמן סיום (UTC) */
    end: { type: Date, required: true },

    /* אזור הזמן – לשימוש בעת המרה ותצוגה בלבד */
    tz: {
      type: String,
      default: "Asia/Bangkok",
      immutable: true,
    },

    /* שדות עזר לצורך שאילתות/תצוגה */
    date: { type: String }, // YYYY-MM-DD (UTC)
    hour: { type: String }, // HH:mm (Asia/Bangkok)
    dayOfWeek: { type: String }, // Sunday / Monday וכו'

    /* פרטי מרצה – לא חובה */
    instructor: { type: String },

    /* סטודיו או חלל */
    studio: {
      type: String,
      enum: ["Studio A", "Studio B"],
      default: "Studio A",
    },

    /* ביטול נקודתי */
    isCancelled: { type: Boolean, default: false },

    /* קיבולת (max participants) */
    capacity: { type: Number, default: 20 },

    /* כמה נרשמו בפועל */
    bookedCount: { type: Number, default: 0 },

    /* סטטוס כללי */
    status: {
      type: String,
      enum: ["scheduled", "full", "cancelled"],
      default: "scheduled",
    },
  },
  { timestamps: true }
);

/* אינדקסים שימושיים */
SessionSchema.index({ workshopId: 1, start: 1 });
SessionSchema.index({ ruleId: 1 });
SessionSchema.index({ start: 1, end: 1 });

export default mongoose.model("Session", SessionSchema);
