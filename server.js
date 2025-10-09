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
import retreatRoutes from "./router/retreatsRoutes.js";
import roomRoutes from "./router/roomRoutes.js";
import uploadsRoutes from "./router/uploadsRoutes.js";

// טוען את המודלים שלך
import User from "./models/User.js";
import Room from "./models/Room.js";
import Booking from "./models/Booking.js";
import PricingRule from "./models/PricingRule.js";

const app = express();
const port = process.env.PORT || 3000;

// ✅ חיבור למונגו
const connectToDb = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log(chalk.greenBright("✅ MongoDB connected successfully"));
  } catch (error) {
    console.error(
      chalk.redBright("❌ MongoDB connection failed:"),
      error.message
    );
    process.exit(1);
  }
};

// ✅ הגדרות בסיס
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
  })
);

app.use(express.json());
if (serverLogger) app.use(serverLogger);
if (logger) app.use(logger);
app.use(express.static("./public"));

app.get("/ping", (req, res) => res.send("pong"));

// ✅ חיבור הראוטרים
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/bookings", bookingRoutes);
app.use("/api/v1/retreats", retreatRoutes);
app.use("/api/v1/rooms", roomRoutes);
app.use("/api/v1/uploads", uploadsRoutes);

// חשוב: אל תשאירי app.use("/api/v1/users", autoController); ❌
// פשוט מחקי את זה — זה מה שגרם לשגיאת autoController undefined

// routes כלליים של המערכת (אם יש)
app.use("/api/v1", router);

// ✅ טיפול בשגיאות כלליות
app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).send("Server Internal Error");
});

// ✅ הפעלת השרת
app.listen(port, () => {
  console.log(
    chalk.blueBright(`🚀 Server running on http://localhost:${port}`)
  );
  connectToDb();
});
