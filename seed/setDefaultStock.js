// seed/setDefaultStock.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import RoomType from "../models/RoomType.js";

dotenv.config();

await mongoose.connect(process.env.MONGO_URI);
await RoomType.updateMany(
  { stock: { $exists: false } },
  { $set: { stock: 1 } }
);
console.log("✅ default stock set");
await mongoose.disconnect();
