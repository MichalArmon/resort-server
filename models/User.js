// models/User.js
import bcrypt from "bcrypt";
import mongoose from "mongoose";
// ... ייבוא bcrypt ...

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    // 💡 שינוי: הסיסמה לא חובה, כיוון שלמשתמשי גוגל אין סיסמה אצלנו
    required: function () {
      return this.loginType === "local";
    },
    select: false,
  },
  role: {
    type: String,
    enum: ["user", "admin"],
    default: "user",
  },
  // 💡 שדה חדש: סוג ההתחברות (local או google)
  loginType: {
    type: String,
    enum: ["local", "google"],
    default: "local",
  },
  googleId: String, // 💡 שדה חדש: ID ייחודי של גוגל
});

// ... userSchema.pre('save', ... הגיבוב נשאר רק אם שדה ה-password קיים ...
userSchema.pre("save", async function (next) {
  // 💡 בדיקה: בצע גיבוב רק אם המשתמש הוא מסוג 'local'
  if (this.loginType !== "local" || !this.isModified("password")) return next();

  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ... userSchema.methods.correctPassword נשאר זהה ...
// ...
// 1. יצירת המודל מתוך הסכמה
const User = mongoose.model("User", userSchema);

// 2. ייצוא המודל כ-DEFAULT
// זה מתקן את השגיאה: 'does not provide an export named default'
export default User;
