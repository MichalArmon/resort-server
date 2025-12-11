// 📁 models/Treatment.js
import mongoose from "mongoose";

const slugify = (s = "") =>
  s
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const ImageSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true },
    publicId: { type: String, trim: true },
    alt: { type: String, trim: true },
  },
  { _id: false }
);

const TreatmentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 140 },
    slug: { type: String, unique: true, index: true },
    category: { type: String, trim: true },
    therapist: { type: String, trim: true },

    duration: { type: Number, default: 60 },

    level: {
      type: String,
      enum: ["all", "beginner", "intermediate", "advanced"],
      default: "all",
    },

    price: { type: Number, min: 0 },
    currency: { type: String, default: "THB" },

    isActive: { type: Boolean, default: true },
    isPrivate: { type: Boolean, default: false },
    isClosed: { type: Boolean, default: false },

    description: { type: String, trim: true, maxlength: 4000 },
    bullets: [{ type: String, trim: true, maxlength: 160 }],

    hero: { type: ImageSchema, default: {} },
    gallery: { type: [ImageSchema], default: [] },

    tags: [{ type: String, trim: true }],
    intensity: {
      type: String,
      enum: ["gentle", "moderate", "deep"],
      default: "gentle",
    },
    contraindications: [{ type: String, trim: true }],

    // ❤️ לייקים
    likesCount: { type: Number, default: 0 },
    likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

TreatmentSchema.pre("validate", function (next) {
  if (!this.slug && this.title) this.slug = slugify(this.title);
  next();
});

const Treatment = mongoose.model("Treatment", TreatmentSchema);
export default Treatment;
