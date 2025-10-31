import mongoose from "mongoose";

const { Schema } = mongoose;

const ImageSchema = new Schema({
  url: String,
  publicId: String,
  alt: String,
});

const WorkshopSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // קטגוריה ישנה (נשארת זמנית)
    category: {
      type: String,
      enum: ["movement", "meditation", "wellness", "creativity", "other"],
      default: "other",
    },
    // ✅ קטגוריה חדשה – הפניה למודל Category
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },
    instructor: {
      type: String,
      trim: true,
    },
    duration: {
      type: String,
      default: "60 min",
    },
    level: {
      type: String,
      enum: ["all", "beginner", "intermediate", "advanced"],
      default: "all",
    },
    description: {
      type: String,
      trim: true,
    },
    bullets: [String],
    hero: ImageSchema,
    gallery: [ImageSchema],
    price: {
      type: Number,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Workshop", WorkshopSchema);
