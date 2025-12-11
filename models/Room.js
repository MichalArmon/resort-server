// 📁 models/Room.js
import mongoose from "mongoose";

const ImageSchema = new mongoose.Schema(
  {
    publicId: { type: String, required: false },
    url: { type: String, required: false },
    alt: { type: String, default: "" },
    width: Number,
    height: Number,
    format: String,
  },
  { _id: false }
);

const RoomSchema = new mongoose.Schema(
  {
    slug: { type: String, unique: true, index: true },
    title: { type: String, required: true },
    blurb: String,
    features: [String],
    maxGuests: Number,
    sizeM2: Number,
    bedType: String,
    priceBase: Number,
    currency: { type: String, default: "USD" },

    hero: ImageSchema,
    images: [ImageSchema],

    stock: { type: Number, default: 1 },
    active: { type: Boolean, default: true },

    // ❤️ לייקים
    likesCount: { type: Number, default: 0 },
    likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

export default mongoose.model("Room", RoomSchema);
