// 📁 server/models/Schedule.js
import mongoose from "mongoose";
const { Schema } = mongoose;

/**
 * שומרת את כל הגריד במסמך אחד (או לפי weekKey אם תרצי כמה תבניות)
 * grid = אובייקט { [day]: { [hour]: { studio1: "...", studio2: "..." } } }
 * איפשרנו Mixed כדי שתוכלי לשנות מבנה בקלות.
 */
const ScheduleSchema = new Schema(
  {
    weekKey: { type: String, default: "default", index: true },
    grid: { type: Schema.Types.Mixed, default: {} },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("Schedule", ScheduleSchema);
