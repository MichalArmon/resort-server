// server/controllers/roomsController.js
import RoomType from "../models/Room.js";

/* ---------- Utils ---------- */
const slugify = (s = "") =>
  s
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

// אם יש לך CLOUDINARY_CLOUD_NAME ב-.env, זה ישתמש בו; אחרת fallback לשם שהשתמשת בו בפרונט
const CLD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "dhje7hbxd";
const cldUrlFromPublicId = (pid) =>
  pid
    ? `https://res.cloudinary.com/${CLD_NAME}/image/upload/f_auto,q_auto/${pid}`
    : null;

/** קולט:
 *  - string (publicId)
 *  - { url, publicId, alt }
 *  - Cloudinary object { secure_url, public_id, ... }
 * ומחזיר אובייקט אחיד { url, publicId, alt, ... }
 */
const toImgObj = (x) => {
  if (!x) return null;
  if (typeof x === "string") {
    return { publicId: x, url: cldUrlFromPublicId(x), alt: "" };
  }
  const publicId = x.public_id || x.publicId || null;
  const url = x.secure_url || x.url || cldUrlFromPublicId(publicId);
  return {
    url: url || null,
    publicId,
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

/** מחזיר תצורה “ידידותית ל-UI” */
const toUI = (doc) => {
  const d = typeof doc.toObject === "function" ? doc.toObject() : doc;
  const slug = d.slug || slugify(d.title || "");
  const heroObj = d.hero ? toImgObj(d.hero) : null;
  const imgs = Array.isArray(d.images) ? d.images.map(toImgObj) : [];

  return {
    // שדות בסיס
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

    // תמונות (גם עשיר וגם מקוצר ל-URL)
    hero: heroObj,
    images: imgs,
    heroUrl: heroObj?.url || null,
    imageUrls: imgs.map((i) => i?.url).filter(Boolean),

    // תאימות למקומות שקוראים type/label
    type: slug,
    label: d.title,

    raw: d, // לעזרה בדיבוג
  };
};

/* ---------- GET /api/v1/rooms/types ---------- */
export const getRoomTypes = async (_req, res) => {
  try {
    const docs = await RoomType.find({ active: true }).lean();
    res.json(docs.map(toUI));
  } catch (e) {
    console.error("getRoomTypes error:", e);
    res.status(500).json({ message: "Failed to fetch room types" });
  }
};

/* ---------- GET /api/v1/rooms/:type ---------- */
export const getRoomByType = async (req, res) => {
  try {
    const { type } = req.params; // slug
    if (!type) return res.status(400).json({ message: "type is required" });

    const rt = await RoomType.findOne({ slug: type, active: true });
    if (!rt) return res.status(404).json({ message: "Room type not found" });

    res.json(toUI(rt));
  } catch (e) {
    console.error("getRoomByType error:", e);
    res.status(500).json({ message: "Failed to fetch room by type" });
  }
};

/* ---------- POST /api/v1/rooms/types ---------- */
/* מקבל hero/images כמחרוזות publicId או כעצמים של Cloudinary/שלנו */
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
    res.status(201).json(toUI(created)); // ← מחזיר אובייקט שטוח עם slug
  } catch (e) {
    console.error("createRoomType error:", e);
    res.status(500).json({ message: "Failed to create room type" });
  }
};

/* ---------- PUT /api/v1/rooms/types/:slug ---------- */
/* עדכון לפי slug קיים; אפשר גם לשנות slug (זהירות בשימוש) */
export const updateRoomTypeBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const doc = await RoomType.findOne({ slug });
    if (!doc) return res.status(404).json({ message: "Room type not found" });

    const {
      title,
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
      slug: nextSlug, // אם שולחים slug חדש
    } = req.body;

    if (title !== undefined) doc.title = title;
    if (blurb !== undefined) doc.blurb = blurb;

    if (hero !== undefined) doc.hero = toImgObj(hero);
    if (images !== undefined) doc.images = toImgArr(images);
    if (features !== undefined)
      doc.features = Array.isArray(features) ? features : [];

    if (maxGuests !== undefined) doc.maxGuests = maxGuests;
    if (sizeM2 !== undefined) doc.sizeM2 = sizeM2;
    if (bedType !== undefined) doc.bedType = bedType;
    if (priceBase !== undefined) doc.priceBase = priceBase;
    if (currency !== undefined) doc.currency = currency || "USD";
    if (stock !== undefined) doc.stock = stock ?? 0;
    if (active !== undefined) doc.active = active !== false;

    if (nextSlug !== undefined) {
      doc.slug = nextSlug || slugify(title || doc.title || slug);
    }

    await doc.save();
    res.json(toUI(doc));
  } catch (e) {
    console.error("updateRoomTypeBySlug error:", e);
    res.status(500).json({ message: "Failed to update room type" });
  }
};

/* ---------- DELETE /api/v1/rooms/types/:slug ---------- */
export const deleteRoomTypeBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const doc = await RoomType.findOneAndDelete({ slug });
    if (!doc) return res.status(404).json({ message: "Room type not found" });
    res.status(204).end();
  } catch (e) {
    console.error("deleteRoomTypeBySlug error:", e);
    res.status(500).json({ message: "Failed to delete room type" });
  }
};
