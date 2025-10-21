// 📁 controllers/manualScheduleController.js
import Schedule from "../models/Schedule.js";

/* ---------- GET לוח ידני ---------- */
export const getManualSchedule = async (req, res) => {
  try {
    const { weekKey = "default" } = req.query;
    const doc = await Schedule.findOne({ weekKey });
    res.json(doc?.grid || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ---------- POST שמירת לוח מלא ---------- */
export const saveManualSchedule = async (req, res) => {
  try {
    const { weekKey = "default", grid } = req.body;
    if (!grid) return res.status(400).json({ error: "Missing grid" });

    const doc = await Schedule.findOneAndUpdate(
      { weekKey },
      { grid },
      { upsert: true, new: true }
    );
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ---------- PUT שמירת תא בודד ---------- */
export const updateCell = async (req, res) => {
  try {
    const { weekKey = "default", day, hour, studio, value } = req.body;
    if (!day || !hour || !studio)
      return res.status(400).json({ error: "Missing params" });

    const doc =
      (await Schedule.findOne({ weekKey })) ||
      new Schedule({ weekKey, grid: {} });

    if (!doc.grid[day]) doc.grid[day] = {};
    if (!doc.grid[day][hour]) doc.grid[day][hour] = {};
    doc.grid[day][hour][studio] = value;

    await doc.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
