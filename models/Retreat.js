// 📁 models/Retreat.js
import mongoose from "mongoose";
import slugify from "slugify";

const ImageSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true },
    alt: { type: String, trim: true },
    publicId: { type: String, trim: true },
  },
  { _id: false }
);

const RetreatSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, unique: true, trim: true, lowercase: true },

    startDate: { type: Date },
    endDate: { type: Date },

    price: { type: Number },
    capacity: { type: Number },
    spotsLeft: { type: Number },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },

    hero: { type: ImageSchema, default: {} },
    gallery: { type: [ImageSchema], default: [] },

    blurb: { type: String },
    description: { type: String },
    features: [String],

    isPrivate: { type: Boolean, default: false },
    isClosed: { type: Boolean, default: false },
    published: { type: Boolean, default: false },

    days: [{ type: mongoose.Schema.Types.ObjectId, ref: "RetreatDay" }],

    // ❤️ לייקים
    likesCount: { type: Number, default: 0 },
    likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

RetreatSchema.pre("save", function (next) {
  if (!this.slug) {
    const base = this.name || "retreat";
    this.slug = slugify(base, { lower: true, strict: true });
  }
  next();
});

export default mongoose.model("Retreat", RetreatSchema);
