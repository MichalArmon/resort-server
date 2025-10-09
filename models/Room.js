// models/RoomType.js
import mongoose from "mongoose";

const RoomTypeSchema = new mongoose.Schema(
  {
    slug: { type: String, unique: true, index: true },
    title: String,
    blurb: String,
    features: [String],
    maxGuests: Number,
    sizeM2: Number,
    bedType: String,
    priceBase: Number,
    currency: { type: String, default: "USD" },
    hero: String,
    images: [String],
    stock: { type: Number, default: 1 }, // 👈 כמה יחידות קיימות מסוג זה
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("RoomType", RoomTypeSchema);
