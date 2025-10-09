// router/uploadsRoutes.js
import express from "express";
import { v2 as cloudinary } from "cloudinary";

const router = express.Router();

// הגדרת Cloudinary דרך משתני הסביבה
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// חתימה מאובטחת ל־Cloudinary (Signed Upload)
router.post("/sign-cloudinary", (req, res) => {
  const { CLOUDINARY_CLOUD_NAME: cloudName, CLOUDINARY_API_KEY: apiKey } =
    process.env;
  if (!cloudName || !apiKey || !process.env.CLOUDINARY_API_SECRET) {
    return res.status(500).json({ message: "Missing Cloudinary env vars" });
  }

  const folder =
    req.body?.folder || process.env.CLOUDINARY_UPLOAD_FOLDER || "ban-tao";
  const timestamp = Math.floor(Date.now() / 1000);

  // יצירת חתימה מדויקת בעזרת ה-SDK
  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder },
    process.env.CLOUDINARY_API_SECRET
  );

  res.json({
    timestamp,
    folder,
    signature,
    apiKey,
    cloudName,
  });
});

export default router;
