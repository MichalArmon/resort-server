import dotenv from "dotenv";
dotenv.config(); // ⭐ חשוב!

import mongoose from "mongoose";
import Room from "../models/Room.js";
import Retreat from "../models/Retreat.js";
import Treatment from "../models/Treatment.js";
import Workshop from "../models/Workshop.js";

const uri =
  process.env.MONGO_URI || process.env.ATLAS_DB || process.env.LOCAL_DB;

async function fix() {
  if (!uri) {
    console.error("❌ Missing DB URI in .env");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("🔧 Connected to MongoDB");
  console.log("🔧 Fixing likes fields...");

  const models = { Room, Retreat, Treatment, Workshop };

  for (const [name, Model] of Object.entries(models)) {
    const result = await Model.updateMany(
      {
        $or: [
          { likesCount: { $exists: false } },
          { likedBy: { $exists: false } },
        ],
      },
      {
        $set: { likesCount: 0, likedBy: [] },
      }
    );

    console.log(`✔ ${name}: updated ${result.modifiedCount} documents`);
  }

  console.log("🎉 Done!");
  process.exit();
}

fix();
