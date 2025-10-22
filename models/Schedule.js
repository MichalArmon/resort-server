// 📁 server/models/Schedule.js (הקוד הנכון)
import mongoose from "mongoose";
const { Schema } = mongoose;

/**
 * שומרת את כל הגריד במסמך אחד (או לפי weekKey אם תרצי כמה תבניות)
 * grid = אובייקט { [day]: { [hour]: { studio1: "...", studio2: "..." } } }
 */
const ScheduleSchema = new Schema(
  {
    weekKey: { type: String, default: "default", index: true },
    grid: { type: Object, required: true },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true }
);

// זהו הייצוא הנכון שקובץ ה-controller מצפה לו
export default mongoose.model("Schedule", ScheduleSchema);
