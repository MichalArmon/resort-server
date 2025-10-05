// index.js (קובץ שרת ראשי)

import dotenv from "dotenv";
dotenv.config(); // טוען משתני סביבה מהקובץ .env

import express from "express";
import mongoose from "mongoose"; // 🛑 חסר: Mongoose לחיבור ל-DB
import chalk from "chalk"; // 🛑 חסר: Chalk לצבע בטרמינל
import cors from "cors";
import logger from "./middlewares/logger.js"; // נניח שזה ה-Logger המקורי
import serverLogger from "./middlewares/loggerService.js"; // נניח שזה ה-Logger הנוסף
import router from "./router/router.js";
import bookingRoutes from "./router/bookingRoutes.js";
import autoController from "./router/authRoutes.js";
import retreatRoutes from "./router/retreatsRoutes.js";
import User from "./models/User.js"; // 💡 נחוץ ל-protect
import Room from "./models/Room.js"; // 💡 נחוץ ל-populate ב-Booking
import Booking from "./models/Booking.js"; // 💡 נחוץ ל-populate
import PricingRule from "./models/PricingRule.js"; // 💡 נחוץ ל-getQuote
// (הוסף כל מודל אחר שיש לך בפרויקט)

// 🛑 ייבוא ניתוב ההזמנות החדש
// שינוי נתיב: routr כנראה טעות הקלדה, תיקנתי ל-routes. ודא שהנתיב נכון אצלך.

const app = express();
const port = process.env.PORT || 3000;

// --- פונקציית חיבור ל-MongoDB (כפי ששלחת) ---
const connectToDb = async () => {
  try {
    // השתמש במשתנה הסביבה MONGO_URI שהגדרת ב-.env
    await mongoose.connect(process.env.MONGO_URI);
    console.log(chalk.greenBright("MongoDB connected successfully."));
  } catch (error) {
    console.error(chalk.redBright("MongoDB connection failed:"), error.message);
    process.exit(1); // יציאה אם החיבור נכשל
  }
};
// ----------------------------------------------

// --- Middlewares והגדרות ---
app.use(
  cors({
    origin: [
      "http://127.0.0.1:5500",
      "http://localhost:5173",
      "http://localhost:5174",
      "https://w271024er-cards.netlify.app",
      "https://michalarmon.github.io",
      "https://michalarmon.github.io/ban-tao-resort",
      "https://bantao.netlify.app",
    ],
  })
);

app.use(express.json());
app.use(serverLogger);
app.use(logger); // אם יש צורך ב-logger נוסף

app.use(express.static("./public"));
app.get("/ping", (req, res) => {
  res.send("pong");
});

// --- ניתובים (Routes) ---

// 🛑 שילוב ניתוב ההזמנות תחת הנתיב /api/bookings
app.use("/api/v1/bookings", bookingRoutes);

app.use("/api/v1/users", autoController);
app.use("/api/v1/retreats", retreatRoutes);

app.use(router); // ניתובים קיימים של הפרויקט האחר

// --- טיפול בשגיאות ---
app.use((error, req, res, next) => {
  console.log(error);
  res.status(500).send("Server Internal Error");
});

// --- הפעלת השרת ---
app.listen(port, () => {
  console.log(chalk.blueBright(`Listening on: http://localhost:${port}`));
  // 🛑 קריאה לפונקציית החיבור ל-DB
  connectToDb();
});
