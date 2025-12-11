import bcrypt from "bcrypt";
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    /* ==========================
       📧 אימייל
       ========================== */
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    /* ==========================
       🔑 סיסמה
       (נדרש רק בהתחברות מקומית)
       ========================== */
    password: {
      type: String,
      required: function () {
        return this.loginType === "local";
      },
      select: false,
    },

    /* ==========================
       🧑‍💼 שם פרטי + משפחה
       ========================== */
    name: {
      first: { type: String, trim: true, default: "" },
      last: { type: String, trim: true, default: "" },
    },

    /* ==========================
       📱 פרטים נוספים
       ========================== */
    phone: { type: String, trim: true, default: "" },
    country: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },

    /* ==========================
       🏷 תפקיד במערכת
       ========================== */
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    /* ==========================
       🎂 נתוני לידה בסיסיים
       ========================== */
    birthDate: {
      type: Date,
      required: false,
    },

    zodiac: {
      type: String,
      trim: true,
      default: "",
      required: false,
    },

    /* ==========================
       🪐 נתוני לידה מלאים למפת לידה
       ========================== */
    birthTime: {
      type: String, // "HH:MM"
      default: "",
    },

    birthPlace: {
      type: String, // עיר/מדינה כמו "Tel Aviv, Israel"
      default: "",
    },

    birthLat: {
      type: Number, // latitude
      default: null,
    },

    birthLon: {
      type: Number, // longitude
      default: null,
    },

    birthTzOffset: {
      type: Number, // למשל 2 או 3
      default: null,
    },

    /* ==========================
       🏠 סטטוס נוכחות באתר
       ========================== */
    inhouseStatus: {
      type: Boolean,
      default: false,
    },

    /* ==========================
       📄 הזמנה פעילה
       ========================== */
    currentBooking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      default: null,
    },

    /* ==========================
       🔐 התחברות
       ========================== */
    loginType: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },

    googleId: { type: String, default: "" },
  },

  {
    timestamps: true,
  }
);

/* ============================================================
   🔐 HASH PASSWORD (Only for local signups)
   ============================================================ */
userSchema.pre("save", async function (next) {
  if (this.loginType !== "local") return next();
  if (!this.isModified("password")) return next();

  this.password = await bcrypt.hash(this.password, 12);
  next();
});

/* ============================================================
   🔍 Compare password
   ============================================================ */
userSchema.methods.correctPassword = async function (
  inputPassword,
  userPassword
) {
  return bcrypt.compare(inputPassword, userPassword);
};

export default mongoose.model("User", userSchema);
