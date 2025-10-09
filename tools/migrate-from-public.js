// tools/migrate-from-public.js
import dotenv from "dotenv";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { v2 as cloudinary } from "cloudinary";
import RoomType from "../models/Room.js";

dotenv.config();

const {
  MONGO_URI,
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
  CLOUDINARY_UPLOAD_FOLDER,
  FRONT_PUBLIC_DIR,
  LEGACY_BASE_URL,
} = process.env;

if (!MONGO_URI) throw new Error("Missing MONGO_URI");
if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
  throw new Error("Missing Cloudinary credentials");
}
if (!FRONT_PUBLIC_DIR && !LEGACY_BASE_URL) {
  console.warn(
    "⚠️  Neither FRONT_PUBLIC_DIR nor LEGACY_BASE_URL defined. Local paths won't resolve."
  );
}

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
});

const isCloudinary = (u) => /^https?:\/\/res\.cloudinary\.com\//i.test(u || "");
const isHttp = (u) => /^https?:\/\//i.test(u || "");

function slugify(s = "") {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function localPathFromPublic(rel) {
  if (!FRONT_PUBLIC_DIR) return null;
  const clean = String(rel || "").replace(/^\/+/, "");
  return path.resolve(FRONT_PUBLIC_DIR, clean);
}

function absoluteFromLegacy(rel) {
  if (!LEGACY_BASE_URL) return null;
  const base = LEGACY_BASE_URL.replace(/\/+$/, "");
  const clean = String(rel || "").replace(/^\/+/, "");
  return `${base}/${clean}`;
}

async function uploadSource(src, folder) {
  if (!src) return null;

  // 1) כבר ב-Cloudinary
  if (isCloudinary(src)) return src;

  // 2) URL מלא אונליין
  if (isHttp(src)) {
    const res = await cloudinary.uploader.upload(src, {
      folder,
      resource_type: "image",
      overwrite: false,
      unique_filename: true,
      use_filename: true,
    });
    return res.secure_url;
  }

  // 3) קובץ מקומי מתוך public (מועדף)
  const local = localPathFromPublic(src);
  if (local && fs.existsSync(local)) {
    const res = await cloudinary.uploader.upload(local, {
      folder,
      resource_type: "image",
      overwrite: false,
      unique_filename: true,
      use_filename: true,
    });
    return res.secure_url;
  }

  // 4) ניסיון אחרון: למשוך דרך כתובת של האתר (אם הוגדר)
  const remote = absoluteFromLegacy(src);
  if (remote) {
    const res = await cloudinary.uploader.upload(remote, {
      folder,
      resource_type: "image",
      overwrite: false,
      unique_filename: true,
      use_filename: true,
    });
    return res.secure_url;
  }

  console.warn("⚠️  Could not resolve source:", src);
  return null;
}

async function run() {
  await mongoose.connect(MONGO_URI);
  const folderBase = CLOUDINARY_UPLOAD_FOLDER || "ban-tao/rooms";

  const docs = await RoomType.find({}).lean();
  let updated = 0;

  for (const rt of docs) {
    const slug = rt.slug || slugify(rt.title || "");
    const folder = `${folderBase}/${slug}`;

    let changed = false;

    // HERO
    let newHero = rt.hero;
    if (rt.hero && !isCloudinary(rt.hero)) {
      newHero = await uploadSource(rt.hero, folder);
      if (newHero && newHero !== rt.hero) changed = true;
    }

    // IMAGES
    const images = Array.isArray(rt.images) ? rt.images : [];
    const newImages = [];
    for (const img of images) {
      if (isCloudinary(img)) {
        newImages.push(img);
        continue;
      }
      const out = await uploadSource(img, folder);
      if (out) {
        newImages.push(out);
        if (out !== img) changed = true;
      }
    }

    // אם אין images אבל יש hero – נוסיף אותו כגלריה
    if ((!newImages || newImages.length === 0) && newHero) {
      newImages.push(newHero);
      if (!images?.length) changed = true;
    }

    if (changed) {
      await RoomType.updateOne(
        { _id: rt._id },
        { $set: { hero: newHero || rt.hero, images: newImages } }
      );
      updated++;
      console.log(
        `✅ ${slug} updated | hero:${!!newHero} images:${newImages.length}`
      );
    } else {
      console.log(`➖ ${slug} no change`);
    }
  }

  console.log(`\n🎉 Done. Updated ${updated}/${docs.length} docs.`);
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
