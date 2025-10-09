import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

// טוען את משתני הסביבה מהקובץ .env
dotenv.config();

// הגדרת Cloudinary מה-env שלך
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// הדפסה לבדיקה
console.log("✅ Current Cloudinary config:");
console.log(cloudinary.config());
