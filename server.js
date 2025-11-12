// ============================================================
// 🌿 Imports
// ============================================================
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import mongoose from "mongoose";
import chalk from "chalk";
import cors from "cors";
import { startDailySessionJob } from "./cron/generateSessionsDaily.js";

import logger from "./middlewares/logger.js"; // אם קיים
import serverLogger from "./middlewares/loggerService.js"; // אם קיים

// ===== ראוטרים =====
import router from "./router/router.js"; // ראוטר כללי תחת /api/v1 (לשים אחרון בבלוק של /api/v1)
import bookingRoutes from "./router/bookingRoutes.js";
import authRoutes from "./router/authRoutes.js";
import retreatRoutes from "./router/retreatsRoutes.js";
import roomRoutes from "./router/roomRoutes.js";
import uploadsRoutes from "./router/uploadsRoutes.js";
import workshopsRoutes from "./router/workshopsRoutes.js";
import treatmentsRoutes from "./router/treatmentsRoutes.js";
import recurringRulesRoutes from "./router/recurringRulesRoutes.js";

import categoryRoutes from "./router/categoryRoutes.js";
import userRoutes from "./router/userRoutes.js";
import sessionRoutes from "./router/sessionRoutes.js";

// (לא חובה לייבא מודלים כאן אם לא משתמשים בהם ישירות, אבל לא מזיק)
import "./models/User.js";
import "./models/Room.js";
import "./models/Booking.js";
import "./models/PricingRule.js";
import "./models/Workshop.js";

const app = express();
const port = process.env.PORT || 3000;

/* ============================================================
 *  CORS
 * ============================================================ */
const ALLOWED_ORIGINS = new Set([
  "http://127.0.0.1:5500",
  "http://localhost:5173",
  "http://localhost:5174",
  "https://michalarmon.github.io",
  "https://michalarmon.github.io/ban-tao-resort",
  "https://bantao.netlify.app",
  // "https://ban-tao.com",
  // "https://www.ban-tao.com",
]);

const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true); // Postman/cURL/Healthchecks
    if (ALLOWED_ORIGINS.has(origin)) return cb(null, true);
    return cb(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
};
app.use(cors(corsOptions)); // ✅ לפני הראוטים

/* ============================================================
 *  Middlewares
 * ============================================================ */
app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" })); // ✅ לפני הראוטים
if (typeof serverLogger === "function") app.use(serverLogger);
if (typeof logger === "function") app.use(logger);
app.use(express.static("./public"));
app.set("trust proxy", true);

/* ============================================================
 *  Healthchecks
 * ============================================================ */
app.get("/ping", (_req, res) => res.send("pong"));
app.get("/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

/* ============================================================
 *  Routes (/api/v1)
 * ============================================================ */
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/categories", categoryRoutes);
app.use("/api/v1/bookings", bookingRoutes);
app.use("/api/v1/retreats", retreatRoutes);
app.use("/api/v1/retreat", retreatRoutes); // אליאס ישן "retret"
app.use("/api/v1/rooms", roomRoutes);
app.use("/api/v1/uploads", uploadsRoutes);
app.use("/api/v1/workshops", workshopsRoutes);
app.use("/api/v1/treatments", treatmentsRoutes);
app.use("/api/v1/recurring-rules", recurringRulesRoutes);
app.use("/api/v1/sessions", sessionRoutes);
app.use("/api/v1/users", userRoutes);

// ✅ חשוב: הראוטר הכללי תחת /api/v1 חייב להגיע *אחרי* כל הספציפיים
app.use("/api/v1", router);

/* ============================================================
 *  404
 * ============================================================ */
app.use((req, res, next) => {
  if (res.headersSent) return next();
  res.status(404).json({ error: "Not Found" });
});

/* ============================================================
 *  Error handler
 * ============================================================ */
app.use((err, _req, res, _next) => {
  console.error("❌", err?.message || err);
  const status =
    typeof err?.status === "number"
      ? err.status
      : String(err?.message || "").startsWith("CORS blocked")
      ? 403
      : 500;
  res.status(status).json({ error: err?.message || "Server Internal Error" });
});

/* ============================================================
 *  MongoDB + Listen
 * ============================================================ */
const start = async () => {
  try {
    const uri =
      process.env.MONGO_URI ||
      process.env.ATLAS_DB ||
      process.env.LOCAL_DB ||
      "";
    if (!uri) {
      throw new Error(
        "Missing Mongo connection string (MONGO_URI / ATLAS_DB / LOCAL_DB)"
      );
    }

    await mongoose.connect(uri);
    console.log(chalk.greenBright("✅ MongoDB connected successfully"));
    startDailySessionJob();

    app.listen(port, () => {
      console.log(
        chalk.blueBright(`🚀 Server running on http://localhost:${port}`)
      );
    });
  } catch (error) {
    console.error(chalk.redBright("❌ MongoDB connection failed:"), error);
    process.exit(1);
  }
};

start();
