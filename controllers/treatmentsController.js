// 📁 server/controllers/treatmentsController.js
import Treatment from "../models/Treatment.js";

/* ---------- Utils ---------- */
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

/** Normalizes:
 *  - string (publicId)
 *  - { url, publicId, alt }
 *  - Cloudinary upload object { secure_url, public_id, ... }
 * -> returns { url, publicId, alt }
 */
const toImgObj = (x) => {
  if (!x) return null;
  if (typeof x === "string") {
    return { url: cldUrlFromPublicId(x) || x, publicId: x, alt: "" };
  }
  if (x.secure_url || x.public_id) {
    return {
      url: x.secure_url || cldUrlFromPublicId(x.public_id),
      publicId: x.public_id || "",
      alt: x.context?.custom?.alt || x.alt || "",
    };
  }
  return {
    url: x.url || (x.publicId ? cldUrlFromPublicId(x.publicId) : null),
    publicId: x.publicId || "",
    alt: x.alt || "",
  };
};

/* ===========================
 *        CREATE
 * =========================== */
export const createTreatment = async (req, res) => {
  try {
    const body = { ...req.body };
    if (!body.slug && body.title) body.slug = slugify(body.title);

    if (body.hero) body.hero = toImgObj(body.hero) || {};
    if (Array.isArray(body.gallery))
      body.gallery = body.gallery.map(toImgObj).filter(Boolean);

    const doc = await Treatment.create(body);
    return res.status(201).json(doc);
  } catch (err) {
    console.error("createTreatment error:", err);
    return res
      .status(400)
      .json({ error: err.message || "Failed to create treatment" });
  }
};

/* ===========================
 *        LIST / FILTER
 * =========================== */
export const listTreatments = async (req, res) => {
  try {
    const {
      q,
      category,
      tags, // comma-separated
      intensity,
      isActive,
      minPrice,
      maxPrice,
      sort = "-createdAt",
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {};

    if (typeof isActive !== "undefined") filter.isActive = isActive === "true";
    if (category) filter.category = category;
    if (intensity) filter.intensity = intensity;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }
    if (tags) {
      const arr = String(tags)
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      if (arr.length) filter.tags = { $all: arr };
    }
    if (q) {
      filter.$or = [
        { title: new RegExp(q, "i") },
        { description: new RegExp(q, "i") },
        { category: new RegExp(q, "i") },
        { tags: new RegExp(q, "i") },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [items, total] = await Promise.all([
      Treatment.find(filter).sort(sort).skip(skip).limit(Number(limit)),
      Treatment.countDocuments(filter),
    ]);

    return res.json({
      items,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
    });
  } catch (err) {
    console.error("listTreatments error:", err);
    return res.status(500).json({ error: "Failed to fetch treatments" });
  }
};

/* ===========================
 *   GET ONE (by id or slug)
 * =========================== */
export const getTreatment = async (req, res) => {
  try {
    const { idOrSlug } = req.params;

    const byId = await Treatment.findById(idOrSlug);
    if (byId) return res.json(byId);

    const bySlug = await Treatment.findOne({ slug: idOrSlug });
    if (bySlug) return res.json(bySlug);

    return res.status(404).json({ error: "Treatment not found" });
  } catch (err) {
    console.error("getTreatment error:", err);
    return res.status(400).json({ error: "Invalid id or slug" });
  }
};

/* ===========================
 *          UPDATE
 * =========================== */
export const updateTreatment = async (req, res) => {
  try {
    const { id } = req.params;
    const body = { ...req.body };

    if (body.title && !body.slug) body.slug = slugify(body.title);
    if (body.hero) body.hero = toImgObj(body.hero) || {};
    if (Array.isArray(body.gallery))
      body.gallery = body.gallery.map(toImgObj).filter(Boolean);

    const updated = await Treatment.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    });
    if (!updated) return res.status(404).json({ error: "Treatment not found" });

    return res.json(updated);
  } catch (err) {
    console.error("updateTreatment error:", err);
    return res
      .status(400)
      .json({ error: err.message || "Failed to update treatment" });
  }
};

/* ===========================
 *          DELETE
 * =========================== */
export const deleteTreatment = async (req, res) => {
  try {
    const { id } = req.params;
    const removed = await Treatment.findByIdAndDelete(id);
    if (!removed) return res.status(404).json({ error: "Treatment not found" });
    return res.json({ ok: true });
  } catch (err) {
    console.error("deleteTreatment error:", err);
    return res.status(400).json({ error: "Failed to delete treatment" });
  }
};
