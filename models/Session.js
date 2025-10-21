// models/Session.js
import mongoose from "mongoose";
const { Schema, Types } = mongoose;

const SessionSchema = new Schema(
  {
    workshopId: { type: Types.ObjectId, ref: "Workshop", required: true },
    ruleId: { type: Types.ObjectId, ref: "RecurringRule", default: null },
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    capacity: { type: Number, default: 12 },
    booked: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["scheduled", "cancelled", "full"],
      default: "scheduled",
    },
    source: { type: String, enum: ["rule", "oneoff"], default: "rule" },
  },
  { timestamps: true }
);

SessionSchema.index({ start: 1, workshopId: 1 }, { unique: true }); // מונע כפילויות
export default mongoose.model("Session", SessionSchema);
