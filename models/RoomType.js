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
  { _id: false } // לא נצטרך _id פנימי לכל תמונה
);

const RoomTypeSchema = new mongoose.Schema(
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

    // 👇 עכשיו hero הוא אובייקט אמיתי, לא רק string
    hero: ImageSchema,

    // 👇 וכל התמונות גם נשמרות כ-array של אובייקטים
    images: [ImageSchema],

    stock: { type: Number, default: 1 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("RoomType", RoomTypeSchema);
