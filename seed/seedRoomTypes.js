import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import dotenv from "dotenv";
import Room from "../models/Room.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error("❌ Missing MONGO_URI in .env");
  process.exit(1);
}

// אם שמרת בפרונט נתיבים יחסיים (/rooms/...), אפשר לעטוף בדומיין ציבורי
const PUBLIC_BASE = process.env.PUBLIC_BASE || ""; // למשל https://your-site.netlify.app

const absUrl = (u) => {
  if (!u) return null;
  if (/^https?:\/\//.test(u)) return u; // כבר URL מלא
  if (!PUBLIC_BASE) return u; // השאירי כמות שהוא, נטפל בזה בשלב Cloudinary
  return `${PUBLIC_BASE.replace(/\/$/, "")}/${u.replace(/^\/+/, "")}`;
};

async function run() {
  await mongoose.connect(MONGO_URI);

  const seedPath = path.resolve("seed/roomTypes.seed.json");
  const raw = fs.readFileSync(seedPath, "utf8");
  const data = JSON.parse(raw);

  for (const [title, item] of Object.entries(data)) {
    const slug = (item.slug || title).toLowerCase().replace(/\s+/g, "-");
    const hero = absUrl(item.hero);
    const images = (item.images || []).map(absUrl);

    await Room.findOneAndUpdate(
      { slug },
      {
        slug,
        title: item.title || title,
        blurb: item.blurb || "",
        features: item.features || [],
        maxGuests: item.maxGuests ?? 2,
        sizeM2: item.sizeM2 ?? 30,
        bedType: item.bedType || "King",
        priceBase: item.priceBase ?? 100,
        currency: item.currency || "USD",
        hero,
        images,
        stock: item.stock ?? 1,
        active: item.active !== false,
      },
      { upsert: true, new: true }
    );
  }

  console.log("✅ RoomTypes seeded/updated");
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
