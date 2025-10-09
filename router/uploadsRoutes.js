// router/uploadsRoutes.js
import express from "express";
import crypto from "crypto";

const router = express.Router();

// חתימה מאובטחת ל־Cloudinary
router.post("/sign-cloudinary", (req, res) => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return res.status(500).json({ message: "Missing Cloudinary env vars" });
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder =
    req.body?.folder || process.env.CLOUDINARY_UPLOAD_FOLDER || "ban-tao";

  // בונים string לחתימה לפי Cloudinary
  const params = new URLSearchParams({
    folder,
    timestamp: String(timestamp),
  }).toString();
  const signature = crypto
    .createHash("sha1")
    .update(params + apiSecret)
    .digest("hex");

  res.json({
    timestamp,
    folder,
    signature,
    apiKey,
    cloudName,
  });
});

export default router;
