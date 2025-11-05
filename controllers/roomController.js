// 📁 server/controllers/roomsController.js
import RoomType from "../models/RoomType.js";

/* ============================================================
   🧩 Helpers
   ============================================================ */
const slugify = (s = "") =>
  s
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const CLD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "dhje7hbxd";
const cldUrlFromPublicId = (pid) =>
  pid
    ? `https://res.cloudinary.com/${CLD_NAME}/image/upload/f_auto,q_auto/${pid}`
    : null;

/* ============================================================
   🖼️ Image Helpers
   ============================================================ */
const toImgObj = (x) => {
  if (!x) return null;
  if (typeof x === "string") {
    return { publicId: x, url: cldUrlFromPublicId(x), alt: "" };
  }
  const publicId = x.public_id || x.publicId || null;
  const url = x.secure_url || x.url || cldUrlFromPublicId(publicId);
  return {
    publicId,
    url: url || null,
    alt: x.alt || "",
    width: x.width,
    height: x.height,
    format: x.format,
  };
};

const toImgArr = (val) => {
  if (!val) return [];
  return (Array.isArray(val) ? val : [val]).map(toImgObj).filter(Boolean);
};

/* ============================================================
   🔄 Format for UI
   ============================================================ */
const toUI = (doc) => {
  const d = typeof doc.toObject === "function" ? doc.toObject() : doc;
  const slug = d.slug || slugify(d.title || "");
  const heroObj = d.hero ? toImgObj(d.hero) : null;
  const imgs = Array.isArray(d.images) ? d.images.map(toImgObj) : [];

  return {
    _id: d._id,
    slug,
    title: d.title,
    blurb: d.blurb || "",
    features: d.features || [],
    maxGuests: d.maxGuests ?? null,
    sizeM2: d.sizeM2 ?? null,
    bedType: d.bedType || null,
    priceBase: d.priceBase ?? null,
    currency: d.currency || "USD",
    stock: d.stock ?? 0,
    active: d.active !== false,

    hero: heroObj,
    images: imgs,
    heroUrl: heroObj?.url || null,
    imageUrls: imgs.map((i) => i?.url).filter(Boolean),

    type: slug,
    label: d.title,
  };
};

/* ============================================================
   📜 GET — All room types
   ============================================================ */
export const getRoomTypes = async (_req, res) => {
  try {
    const docs = await RoomType.find({}).lean();
    res.json(docs.map(toUI));
  } catch (e) {
    console.error("getRoomTypes error:", e);
    res.status(500).json({ message: "Failed to fetch room types" });
  }
};

/* ============================================================
   📘 GET — By slug (for guests)
   ============================================================ */
export const getRoomByType = async (req, res) => {
  try {
    const { type } = req.params;
    if (!type) return res.status(400).json({ message: "type is required" });

    const rt = await RoomType.findOne({ slug: type, active: true });
    if (!rt) return res.status(404).json({ message: "Room type not found" });

    res.json(toUI(rt));
  } catch (e) {
    console.error("getRoomByType error:", e);
    res.status(500).json({ message: "Failed to fetch room by type" });
  }
};

/* ============================================================
   📗 GET — By ID (for admin)
   ============================================================ */
export const getRoomTypeById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: "Missing ID" });

    const room = await RoomType.findById(id);
    if (!room) return res.status(404).json({ message: "Room not found" });

    res.json(toUI(room));
  } catch (e) {
    console.error("getRoomTypeById error:", e);
    res.status(500).json({ message: "Failed to fetch room by ID" });
  }
};

/* ============================================================
   ➕ POST — Create new room type
   ============================================================ */
export const createRoomType = async (req, res) => {
  try {
    const {
      title,
      slug,
      blurb,
      hero,
      images,
      features,
      maxGuests,
      sizeM2,
      bedType,
      priceBase,
      currency,
      stock,
      active,
    } = req.body;

    if (!title) return res.status(400).json({ message: "Missing title" });

    const payload = {
      title,
      slug: slug || slugify(title),
      blurb: blurb || "",
      hero: toImgObj(hero),
      images: toImgArr(images),
      features: Array.isArray(features) ? features : [],
      maxGuests,
      sizeM2,
      bedType,
      priceBase,
      currency: currency || "USD",
      stock: stock ?? 0,
      active: active !== false,
    };

    const created = await RoomType.create(payload);
    res.status(201).json(toUI(created));
  } catch (e) {
    console.error("createRoomType error:", e);
    res.status(500).json({ message: "Failed to create room type" });
  }
};

/* ============================================================
   ✏️ PUT — Update by ID (for admin)
   ============================================================ */
export const updateRoomTypeById = async (req, res) => {
  try {
    const { id } = req.params;
    const room = await RoomType.findById(id);
    if (!room) return res.status(404).json({ message: "Room not found" });

    const body = req.body;

    // ננקה ונעדכן רק שדות רלוונטיים למודל
    const fields = [
      "title",
      "slug",
      "blurb",
      "features",
      "maxGuests",
      "sizeM2",
      "bedType",
      "priceBase",
      "currency",
      "stock",
      "active",
      "hero",
      "images",
    ];
    for (const key of fields) {
      if (body[key] !== undefined) {
        if (key === "hero") room.hero = toImgObj(body.hero);
        else if (key === "images") room.images = toImgArr(body.images);
        else room[key] = body[key];
      }
    }

    if (body.title && !body.slug) room.slug = slugify(body.title);

    await room.save();
    res.json(toUI(room));
  } catch (e) {
    console.error("updateRoomTypeById error:", e);
    res
      .status(500)
      .json({ message: "Failed to update room type", error: e.message });
  }
};

/* ============================================================
   ❌ DELETE — By ID (for admin)
   ============================================================ */
export const deleteRoomTypeById = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await RoomType.findByIdAndDelete(id);
    if (!doc) return res.status(404).json({ message: "Room type not found" });
    res.status(204).end();
  } catch (e) {
    console.error("deleteRoomTypeById error:", e);
    res.status(500).json({ message: "Failed to delete room type" });
  }
};
