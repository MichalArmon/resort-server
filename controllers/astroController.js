// controllers/astroController.js
import axios from "axios";
import User from "../models/User.js";

export const getBirthChart = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) return res.status(404).json({ message: "User not found" });

    if (
      !user.birthDate ||
      !user.birthTime ||
      !user.birthLat ||
      !user.birthLon
    ) {
      return res.status(400).json({ message: "Missing birth details" });
    }

    const apiKey = process.env.FREE_ASTRO_KEY;
    const url = "https://json.freeastrologyapi.com/western/natal-wheel-chart";

    const date = new Date(user.birthDate);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const [hours, minutes] = user.birthTime.split(":").map(Number);

    const payload = {
      year,
      month,
      date: day,
      hours,
      minutes,
      seconds: 0,
      latitude: Number(user.birthLat),
      longitude: Number(user.birthLon),
      timezone: Number(user.birthTzOffset || 3),
    };

    console.log("📤 Sending Payload:", payload);

    const { data } = await axios.post(url, payload, {
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
    });

    console.log("📥 RAW API response:", data);

    // ה־API מחזיר { statusCode, output: URL }
    if (!data?.output) {
      return res.status(500).json({
        message: "API did not return a chart URL",
        raw: data,
      });
    }

    res.json({
      success: true,
      svgUrl: data.output, // חשוב!!
    });
  } catch (err) {
    console.error("Wheel Error:", err.response?.data || err.message);
    res.status(500).json({
      message: "Failed generating birth chart",
      error: err.response?.data || err.message,
    });
  }
};
