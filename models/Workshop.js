import mongoose from "mongoose";
import slugify from "slugify";

const { Schema } = mongoose;

/* ======================================
   תת־סכמה לתמונות
   ====================================== */
const ImageSchema = new Schema({
  url: String,
  publicId: String,
  alt: String,
});

/* ======================================
   סכמה ראשית — סדנאות
   ====================================== */
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

    // ✅ קטגוריה חדשה – רפרנס למודל Category
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },

    instructor: {
      type: String,
      trim: true,
    },

    duration: {
      type: Number,
      default: 60,
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

    price: Number,

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

/* ======================================
   Middlewares — ניהול slug
   ====================================== */

// בעת יצירה — ניצור slug אם לא הוזן
WorkshopSchema.pre("save", function (next) {
  if (!this.slug && this.title) {
    this.slug = slugify(this.title, { lower: true, strict: true });
  }
  next();
});

// בעת עדכון דרך findOneAndUpdate — נטפל גם שם
WorkshopSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate();

  // אם המשתמש עדכן title אבל לא שלח slug חדש — נעדכן אוטומטית
  if (update.title && !update.slug) {
    update.slug = slugify(update.title, { lower: true, strict: true });
  }

  this.setUpdate(update);
  next();
});

/* ======================================
   Virtuals – קישור לכללי חזרתיות ול־Sessions
   ====================================== */

// כלל חזרתיות (RecurringRule)
WorkshopSchema.virtual("rules", {
  ref: "RecurringRule",
  localField: "_id",
  foreignField: "workshopId",
});

// ✅ חיבור לכל המופעים בפועל (Sessions)
WorkshopSchema.virtual("sessions", {
  ref: "Session", // שם המודל
  localField: "_id", // שדה מקומי ב־Workshop
  foreignField: "workshopId", // שדה במודל Session שמצביע על הסדנה
});

// מוודאים שהווירטואלים נכללים בהמרות ל־JSON / Object
WorkshopSchema.set("toObject", { virtuals: true });
WorkshopSchema.set("toJSON", { virtuals: true });

/* ======================================
   ייצוא המודל
   ====================================== */
export default mongoose.model("Workshop", WorkshopSchema);
