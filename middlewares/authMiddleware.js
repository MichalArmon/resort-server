// middlewares/authMiddleware.js

import jwt from "jsonwebtoken";
import User from "../models/User.js"; // 💡 ודא שהנתיב למודל המשתמש נכון

// ----------------------------------------------------
// 1. Middleware: הגנת אימות (Authentication)
//    מוודא שהמשתמש מחובר ויש לו JWT תקף
// ----------------------------------------------------
export const protect = async (req, res, next) => {
  let token;

  // 1. קבלת הטוקן מה-Header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    // פורמט: Authorization: Bearer <token>
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    // אם לא נשלח טוקן
    return res.status(401).json({
      status: "fail",
      message: "Access denied. Please log in to get access.",
    });
  }

  try {
    // 2. אימות הטוקן
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3. מציאת המשתמש ב-DB (שימושי לשליפת ה-role הנוכחי)
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        status: "fail",
        message: "The user belonging to this token no longer exists.",
      });
    }

    // 4. העברת המשתמש לבקשה (לשימוש עתידי ב-Controllers וב-restrictTo)
    req.user = user;

    // מעבר לפונקציה הבאה ב-Route
    next();
  } catch (err) {
    // אם הטוקן פג תוקף, שונה, או לא תקין
    res
      .status(401)
      .json({ status: "fail", message: "Invalid or expired token." });
  }
};

// ----------------------------------------------------
// 2. Middleware: הגבלת הרשאה (Authorization)
//    מוודא שלמשתמש יש את התפקיד המתאים
// ----------------------------------------------------
export const restrictTo = (...roles) => {
  // הפונקציה מחזירה middleware בפועל
  return (req, res, next) => {
    // 💡 הערה: req.user חייב להיות קיים, לכן protect חייב לרוץ לפני restrictTo!
    if (!req.user || !roles.includes(req.user.role)) {
      // אם התפקיד של המשתמש לא נמצא ברשימת התפקידים המורשים
      return res.status(403).json({
        status: "fail",
        message:
          "Forbidden: You do not have permission to perform this action.",
      });
    }
    // אם התפקיד תקין (admin, employee, guest וכו'), ממשיכים
    next();
  };
};
