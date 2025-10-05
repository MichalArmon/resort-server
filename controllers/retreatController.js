import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
dayjs.extend(utc);

import Retreat from "../models/Retreat.js";
import { buildDaysMap } from "../utils/buildDaysMap.js";

// עטיפת async קטנה
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**

 */
export const getMonthlyRetreats = asyncHandler(async (req, res) => {
  const year = parseInt(req.query.year, 10);
  const month = parseInt(req.query.month, 10); // 1-12

  if (!year || !month) {
    return res.status(400).json({ error: "year and month are required" });
  }

  const monthStart = dayjs
    .utc(`${year}-${String(month).padStart(2, "0")}-01`)
    .startOf("month");
  const monthEnd = monthStart.endOf("month");

  // חיתוך לפי חפיפה לטווח החודש
  const retreats = await Retreat.find({
    startDate: { $lte: monthEnd.toDate() },
    endDate: { $gte: monthStart.toDate() },
  }).lean();

  const days = buildDaysMap(retreats, monthStart, monthEnd);
  res.json({ days });
});

/**
 * דוגמאות נוספות (אופציונלי)
 */
export const getRetreatById = asyncHandler(async (req, res) => {
  const r = await Retreat.findById(req.params.id).lean();
  if (!r) return res.status(404).json({ error: "Not found" });
  res.json(r);
});

export const createRetreat = asyncHandler(async (req, res) => {
  const { name, type, startDate, endDate, soldOut } = req.body;
  const created = await Retreat.create({
    name,
    type,
    startDate,
    endDate,
    soldOut,
  });
  res.status(201).json(created);
});

export const updateRetreat = asyncHandler(async (req, res) => {
  const updated = await Retreat.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  }).lean();
  if (!updated) return res.status(404).json({ error: "Not found" });
  res.json(updated);
});

export const deleteRetreat = asyncHandler(async (req, res) => {
  const deleted = await Retreat.findByIdAndDelete(req.params.id).lean();
  if (!deleted) return res.status(404).json({ error: "Not found" });
  res.status(204).end();
});

export const getCalendarDays = asyncHandler(async (req, res) => {
  const months = Math.max(
    1,
    Math.min(parseInt(req.query.months ?? "24", 10) || 24, 60)
  ); // אפשר גם 60 אם תרצי
  const startUtc = dayjs.utc().startOf("month");
  const endUtc = startUtc.add(months - 1, "month").endOf("month");

  const retreats = await Retreat.find({
    startDate: { $lte: endUtc.toDate() },
    endDate: { $gte: startUtc.toDate() },
  }).lean();

  const days = buildDaysMap(retreats, startUtc, endUtc); // מחזיר { "YYYY-MM-DD": {type,name,...} }
  res.json({
    range: {
      start: startUtc.format("YYYY-MM-DD"),
      end: endUtc.format("YYYY-MM-DD"),
    },
    days,
  });
});
