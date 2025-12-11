// 📁 models/Workshop.js
import mongoose from "mongoose";
import slugify from "slugify";

const { Schema } = mongoose;

const ImageSchema = new Schema({
  url: String,
  publicId: String,
  alt: String,
});

const WorkshopSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },

    slug: { type: String, unique: true, lowercase: true, trim: true },

    category: {
      type: String,
      enum: ["movement", "meditation", "wellness", "creativity", "other"],
      default: "other",
    },

    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },

    instructor: { type: String, trim: true },
    duration: { type: Number, default: 60 },

    level: {
      type: String,
      enum: ["all", "beginner", "intermediate", "advanced"],
      default: "all",
    },

    description: { type: String, trim: true },
    bullets: [String],

    hero: ImageSchema,
    gallery: [ImageSchema],

    price: Number,
    isActive: { type: Boolean, default: true },

    // ❤️ לייקים
    likesCount: { type: Number, default: 0 },
    likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

/* ---------- Slug middlewares ---------- */
WorkshopSchema.pre("save", function (next) {
  if (!this.slug && this.title) {
    this.slug = slugify(this.title, { lower: true, strict: true });
  }
  next();
});

WorkshopSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate();
  if (update.title && !update.slug) {
    update.slug = slugify(update.title, { lower: true, strict: true });
  }
  this.setUpdate(update);
  next();
});

/* ---------- Virtuals ---------- */
WorkshopSchema.virtual("rules", {
  ref: "RecurringRule",
  localField: "_id",
  foreignField: "workshopId",
});

WorkshopSchema.virtual("sessions", {
  ref: "Session",
  localField: "_id",
  foreignField: "workshopId",
});

WorkshopSchema.set("toObject", { virtuals: true });
WorkshopSchema.set("toJSON", { virtuals: true });

export default mongoose.model("Workshop", WorkshopSchema);
