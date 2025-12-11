// models/TreatmentSession.js
import mongoose from "mongoose";

const TreatmentSessionSchema = new mongoose.Schema({
  treatment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Treatment",
    required: true,
  },
  start: { type: Date, required: true },
  end: { type: Date, required: true },
  isBooked: { type: Boolean, default: false },
  bookedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
});

TreatmentSessionSchema.index({ treatment: 1, start: 1 }, { unique: true });

export default mongoose.model("TreatmentSession", TreatmentSessionSchema);
