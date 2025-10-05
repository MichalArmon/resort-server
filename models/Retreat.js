// models/Retreat.js

import mongoose from "mongoose";

const retreatSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true, // שם הריטריט צריך להיות ייחודי
    },
    type: {
      type: String,
      enum: ["Yoga", "Detox", "Skiing", "Cooking", "Other"], // 🔑 4 הסוגים שלך (בתוספת Other)
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    soldOut: { type: Boolean, default: false },
    // רשימת משתתפים (ניתן להוסיף כאן קישור למודל User או פרטי Guest Info)
    // כרגע נשמור את זה פשוט, אם כי לרוב זה שדה מורכב יותר
    participants: {
      type: [String], // מערך של כתובות אימייל של המשתתפים
      default: [],
    },
    // תפקיד: למקרה שנרצה להגביל את הצפייה בפרטי הריטריט רק למנהל/עובד
    isPrivate: {
      type: Boolean,
      default: true, // מניחים שריטריט הוא תמיד פרטי/סגור
    },
    isClosed: {
      type: Boolean,
      default: false, // הריטריט פתוח להזמנות עד שמלא/נחסם ידנית
    },
    price: {
      type: Number,
      required: true, // מחיר הריטריט חייב להיות מוגדר
    },
  },
  { timestamps: true }
);

const Retreat = mongoose.model("Retreat", retreatSchema);
export default Retreat;
