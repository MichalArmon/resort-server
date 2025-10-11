// server.js
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import mongoose from "mongoose";
import chalk from "chalk";
import cors from "cors";
import logger from "./middlewares/logger.js"; // אם קיים
import serverLogger from "./middlewares/loggerService.js"; // אם קיים

// כל הראוטרים שלך
import router from "./router/router.js";
import bookingRoutes from "./router/bookingRoutes.js";
import authRoutes from "./router/authRoutes.js";
import retreatRoutes from "./router/retreatsRoutes.js"; // ← ודאי שם קובץ נכון
import roomRoutes from "./router/roomRoutes.js";
import uploadsRoutes from "./router/uploadsRoutes.js";

// טוען את המודלים שלך (לא חובה לייבא כאן אם לא משתמשים ישירות)
import "./models/User.js";
import "./models/Room.js";
import "./models/Booking.js";
import "./models/PricingRule.js";

const app = express();
const port = process.env.PORT || 3000;

// ✅ הגדרות בסיס: CORS + JSON + סטטי
app.use(
  cors({
    origin: [
      "http://127.0.0.1:5500",
      "http://localhost:5173",
      "http://localhost:5174",
      "https://michalarmon.github.io",
      "https://michalarmon.github.io/ban-tao-resort",
      "https://bantao.netlify.app",
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
    optionsSuccessStatus: 204,
  })
);

app.use(express.json({ limit: "2mb" }));
if (serverLogger) app.use(serverLogger);
if (logger) app.use(logger);
app.use(express.static("./public"));

// 🩺 health
app.get("/ping", (req, res) => res.send("pong"));

// ✅ חיבור הראוטרים
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/bookings", bookingRoutes);
app.use("/api/v1/retreats", retreatRoutes);
// אליאס “RETRET” בלי לשכפל קוד:
app.use("/api/v1/retret", retreatRoutes);
app.use("/api/v1/rooms", roomRoutes);
app.use("/api/v1/uploads", uploadsRoutes);

// routes כלליים
app.use("/api/v1", router);

// 404 ידידותי
app.use((req, res, next) => {
  if (res.headersSent) return next();
  res.status(404).json({ error: "Not Found" });
});

// ✅ טיפול בשגיאות כלליות
app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: error?.message || "Server Internal Error" });
});

// ✅ חיבור למונגו ואז הפעלת השרת (await! חשוב)
const start = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log(chalk.greenBright("✅ MongoDB connected successfully"));
    app.listen(port, () => {
      console.log(
        chalk.blueBright(`🚀 Server running on http://localhost:${port}`)
      );
    });
  } catch (error) {
    console.error(
      chalk.redBright("❌ MongoDB connection failed:"),
      error.message
    );
    process.exit(1);
  }
};
start();
