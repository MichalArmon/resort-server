import mongoose from "mongoose";
const { Schema, Types } = mongoose;

/**
 * Session = מופע בודד של חוג/סדנה
 * נוצר אוטומטית מתוך RecurringRule או ידנית (oneoff)
 */
const SessionSchema = new Schema(
  {
    // קישור ל־Workshop (החוג)
    workshopId: { type: Types.ObjectId, ref: "Workshop", required: true },

    // קישור לחוק המחזוריות (אם נוצר מחוק כזה)
    ruleId: { type: Types.ObjectId, ref: "RecurringRule", default: null },

    // פרטים בסיסיים
    start: { type: Date, required: true },
    end: { type: Date, required: true },

    // לזיהוי לוגי/פילטרים
    date: { type: String, required: false }, // YYYY-MM-DD
    hour: { type: String, required: false }, // HH:00
    tz: { type: String, default: "Asia/Jerusalem" },

    // זיהוי וניווט
    workshopSlug: { type: String, default: null },
    workshopTitle: { type: String, default: null },
    studio: { type: String, default: "Unassigned" },

    // נתוני תפוסה
    capacity: { type: Number, default: 12 },
    booked: { type: Number, default: 0 },

    // סטטוס כללי
    status: {
      type: String,
      enum: ["scheduled", "cancelled", "full"],
      default: "scheduled",
    },

    // מקור הנתון (rule = ממחזוריות, oneoff = נוצר ידנית)
    source: {
      type: String,
      enum: ["rule", "oneoff", "recurring"],
      default: "rule",
    },
  },
  { timestamps: true }
);

// אינדקס ייחודי כדי למנוע כפילויות — לפי החוג, הסטודיו והזמן
SessionSchema.index({ workshopId: 1, studio: 1, start: 1 }, { unique: true });

export default mongoose.model("Session", SessionSchema);
