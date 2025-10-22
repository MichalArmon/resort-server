import Schedule from "../models/Schedule.js";

/* GET /api/v1/schedule?weekKey=default */
export const getManualSchedule = async (req, res) => {
  try {
    const { weekKey = "default" } = req.query;
    const doc = await Schedule.findOne({ weekKey });
    // להחזיר אובייקט פשוט (כמו שהקונטקסט מצפה)
    return res.json(doc?.grid || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* POST /api/v1/schedule  { weekKey, grid } */
export const saveManualSchedule = async (req, res) => {
  try {
    const { weekKey = "default", grid } = req.body;
    if (!grid) return res.status(400).json({ error: "Missing grid" });

    const doc = await Schedule.findOneAndUpdate(
      { weekKey },
      { grid },
      { upsert: true, new: true }
    );
    return res.json({ grid: doc.grid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* PUT /api/v1/schedule/cell { weekKey, day, hour, studio, value } */
export const updateCell = async (req, res) => {
  try {
    const { weekKey = "default", day, hour, studio, value } = req.body;
    if (!day || hour == null || !studio)
      return res.status(400).json({ error: "Missing params" });

    const doc =
      (await Schedule.findOne({ weekKey })) ||
      new Schedule({ weekKey, grid: {} });

    if (!doc.grid[day]) doc.grid[day] = {};
    if (!doc.grid[day][hour]) doc.grid[day][hour] = {};
    doc.grid[day][hour][studio] = value;

    await doc.save();
    return res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
