// 📁 server/models/Treatment.js
import mongoose from "mongoose";

/* ---------- Helpers ---------- */
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
    category: { type: String, trim: true }, // e.g. "massage", "ice-bath", "hydro"
    therapist: { type: String, trim: true }, // optional

    // Duration & level
    duration: { type: String, trim: true }, // e.g. "60 min"
    durationMinutes: { type: Number, min: 10, max: 300 },
    level: {
      type: String,
      enum: ["all", "beginner", "intermediate", "advanced"],
      default: "all",
    },

    // Pricing
    price: { type: Number, min: 0 },
    currency: { type: String, default: "THB" },

    // Status
    isActive: { type: Boolean, default: true },
    isPrivate: { type: Boolean, default: false }, // if booking by request only
    isClosed: { type: Boolean, default: false }, // temporarily unavailable

    // Copy
    description: { type: String, trim: true, maxlength: 4000 },
    bullets: [{ type: String, trim: true, maxlength: 160 }],

    // Media
    hero: { type: ImageSchema, default: {} },
    gallery: { type: [ImageSchema], default: [] },

    // Matching (למנוע ההמלצות בהמשך)
    tags: [{ type: String, trim: true }], // ["water","breath","relax","detox"]
    intensity: {
      type: String,
      enum: ["gentle", "moderate", "deep"],
      default: "gentle",
    },
    contraindications: [{ type: String, trim: true }], // ["pregnancy","hypertension"]
  },
  { timestamps: true }
);

/* ---------- Slug ---------- */
TreatmentSchema.pre("validate", function (next) {
  if (!this.slug && this.title) this.slug = slugify(this.title);
  next();
});

const Treatment = mongoose.model("Treatment", TreatmentSchema);
export default Treatment;
