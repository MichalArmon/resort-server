// controllers/authController.js - הפונקציות בלבד!

import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Booking from "../models/Booking.js";
import { OAuth2Client } from "google-auth-library";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ----------------------------------------------------
// פונקציית עזר: יצירת JWT
// ----------------------------------------------------
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

// ----------------------------------------------------
// פונקציית הרשמה חדשה
// ----------------------------------------------------
export const signup = async (req, res) => {
  try {
    // 💡 1. יצירת משתמש חדש
    // משתמשים ב-req.body, ומודל Mongoose מטפל ב-hashing של הסיסמה.
    // אם לא נשלח 'role', המודל (User.js) יקבע אותו ל'user' כברירת מחדל.
    const newUser = await User.create({
      email: req.body.email,
      password: req.body.password,
      role: req.body.role, // יכול להיות 'admin' או 'user' (ברירת מחדל)
      loginType: "local",
      // אם יש שדות נוספים חובה במודל (כמו name), יש להוסיף אותם ל-req.body!
    });

    // 💡 2. הנפקת טוקן JWT
    const token = signToken(newUser._id);

    // 💡 3. החזרת תשובה
    res.status(201).json({
      status: "success",
      token,
      data: {
        user: {
          id: newUser._id,
          email: newUser.email,
          role: newUser.role,
        },
      },
    });
  } catch (err) {
    // 💡 טיפול בשגיאות: דוא"ל קיים (unique error), שגיאות ולידציה וכו'.
    // שגיאת דוא"ל קיים ב-MongoDB היא בדרך כלל קוד 11000.
    if (err.code === 11000) {
      return res
        .status(400)
        .json({ status: "fail", message: "Email address already in use." });
    }
    // שגיאות ולידציה (כמו סיסמה קצרה מדי)
    res.status(400).json({
      status: "fail",
      message: err.message,
    });
  }
};

// ----------------------------------------------------
// פונקציית לוגין
// ----------------------------------------------------
// controllers/authController.js (פונקציית googleAuth מלאה)

export const googleAuth = async (req, res) => {
  const { idToken } = req.body;

  if (!idToken) {
    return res.status(400).json({
      status: "fail",
      message: "ID Token is missing.",
    });
  }

  try {
    // 1. אימות הטוקן מול גוגל
    const ticket = await client.verifyIdToken({
      idToken: idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const email = payload.email;
    const name = payload.name; // נשתמש בזה אם המודל דורש שם

    // 2. מציאת/יצירת משתמש ב-DB
    let user = await User.findOne({ email });

    if (!user) {
      // אם אין משתמש, ניצור חדש
      user = await User.create({
        email: email,
        name: name, // אם רלוונטי
        loginType: "google",
        role: "user", // תפקיד ברירת מחדל
      });
    }

    // 3. הנפקת טוקן JWT
    const token = signToken(user._id);

    res.status(200).json({
      status: "success",
      token,
      data: { user: { id: user._id, role: user.role, email: user.email } },
    });
  } catch (error) {
    console.error("Google Auth Error:", error);
    res
      .status(401)
      .json({ status: "fail", message: "Invalid Google ID Token." });
  }
};
// ----------------------------------------------------
// פונקציית לוגין ל
// ----------------------------------------------------
export const login = async (req, res) => {
  const { email, password } = req.body;

  // 1. ודא שהאימייל והסיסמה נשלחו
  if (!email || !password) {
    return res.status(400).json({
      status: "fail",
      message: "Please provide email and password.",
    });
  }

  // 2. מצא את המשתמש ב-DB
  // 💡 חשוב: המודל User צריך להיות מוגדר לבחור את הסיסמה (select: false)
  const user = await User.findOne({ email }).select("+password");

  // 3. ודא שהמשתמש קיים ושהסיסמה נכונה
  // נניח שיש פונקציית השוואת סיסמאות בתוך המודל User
  if (!user || !(await user.correctPassword(password, user.password))) {
    return res.status(401).json({
      status: "fail",
      message: "Incorrect email or password.",
    });
  }

  // 4. הנפק טוקן חדש
  const token = signToken(user._id);

  // 5. הסר את הסיסמה מהתשובה
  user.password = undefined;

  res.status(200).json({
    status: "success",
    token,
    data: { user: { id: user._id, role: user.role, email: user.email } },
  });
};

// controllers/authController.js (פונקציית guestLogin)

export const guestLogin = async (req, res) => {
  // 💡 מקבלים מספר הזמנה ואימייל
  const { bookingNumber, email } = req.body;

  if (!bookingNumber || !email) {
    return res.status(400).json({
      status: "fail",
      message: "Please provide booking number and email.",
    });
  }

  // 1. אימות ההזמנה מול DB
  const booking = await Booking.findOne({
    bookingNumber: bookingNumber,
    "guestInfo.email": email, // 💡 חיפוש בתוך אובייקט מקונן
    status: "Confirmed", // רק הזמנות מאושרות
    // 💡 בדיקה אם ההזמנה עדיין בתוקף (לאחר checkOutDate או עתידית)
    checkOutDate: { $gte: new Date() },
  });

  if (!booking) {
    return res.status(401).json({
      status: "fail",
      message:
        "Invalid booking details or no active/future confirmed booking found.",
    });
  }

  // 2. מציאת/יצירת משתמש "אורח" קבוע
  let user = await User.findOne({ email });

  if (!user) {
    // אם אין משתמש, ניצור משתמש חדש עם התפקיד 'guest'
    user = await User.create({
      email: email,
      loginType: "local", // אפשר גם להגדיר כ-'guest' אם תרצה להוסיף enum כזה
      role: "guest",
    });
  }
  // אם קיים, הוא כבר יהיה 'user' או 'guest' ב-DB

  // 3. הנפקת טוקן JWT
  const token = signToken(user._id);

  res.status(200).json({
    status: "success",
    token,
    data: { user: { id: user._id, role: user.role, email: user.email } },
  });
};
