// 📁 server/models/Schedule.js (הקוד הנכון)
import mongoose from "mongoose";
const { Schema } = mongoose;

/**
 * שומרת את כל הגריד במסמך אחד (או לפי weekKey אם תרצי כמה תבניות)
 * grid = אובייקט { [day]: { [hour]: { studio1: "...", studio2: "..." } } }
 * איפשרנו Object כדי שתוכלי לשנות מבנה בקלות.
 */
const ScheduleSchema = new Schema(
  {
    weekKey: { type: String, default: "default", index: true },
    grid: { type: Object, required: true },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true }
);

// הייצוא עם export default הוא הקריטי לפתרון שגיאת ה-SyntaxError
export default mongoose.model("Schedule", ScheduleSchema);
