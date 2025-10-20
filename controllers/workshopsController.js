import Workshop from "../models/Workshop.js";

/* ---------- Utils ---------- */
const slugify = (s = "") =>
  s
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const normalizeImage = (x) => {
  if (!x) return null;
  if (typeof x === "string") return { url: x, publicId: null, alt: "" };
  if (x.secure_url || x.url) {
    return {
      url: x.secure_url || x.url,
      publicId: x.public_id || x.publicId || null,
      alt: x.alt || "",
    };
  }
  if (x.publicId)
    return { url: x.url || null, publicId: x.publicId, alt: x.alt || "" };
  return null;
};

const normalizeGallery = (arr) =>
  Array.isArray(arr) ? arr.map(normalizeImage).filter(Boolean) : [];

/* ---------- Controllers ---------- */

// GET /workshops
export async function listWorkshops(req, res) {
  try {
    const {
      q,
      category,
      isActive,
      limit = 50,
      skip = 0,
      select,
      sort = "-updatedAt",
    } = req.query;

    const find = {};
    if (category) find.category = category;
    if (typeof isActive !== "undefined") find.isActive = isActive === "true";

    if (q) {
      find.$or = [
        { title: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
        { instructor: { $regex: q, $options: "i" } },
      ];
    }

    const cursor = Workshop.find(find)
      .sort(sort)
      .skip(Number(skip))
      .limit(Number(limit));
    if (select) cursor.select(select.replaceAll(",", " "));
    const items = await cursor.lean();

    const total = await Workshop.countDocuments(find);
    res.json({ items, total });
  } catch (err) {
    console.error("listWorkshops error:", err);
    res.status(500).json({ error: "Failed to list workshops" });
  }
}

// GET /workshops/:slug
export async function getWorkshop(req, res) {
  try {
    const { slug } = req.params;
    const doc = await Workshop.findOne({ slug }).lean();
    if (!doc) return res.status(404).json({ error: "Workshop not found" });
    res.json(doc);
  } catch (err) {
    console.error("getWorkshop error:", err);
    res.status(500).json({ error: "Failed to get workshop" });
  }
}

// POST /workshops
export async function createWorkshop(req, res) {
  try {
    const {
      title,
      slug,
      category,
      instructor,
      duration,
      level,
      description,
      bullets,
      hero,
      gallery,
      price,
      isActive,
    } = req.body;

    const finalSlug = slug ? slugify(slug) : slugify(title);
    if (!title) return res.status(400).json({ error: "title is required" });

    const exists = await Workshop.findOne({ slug: finalSlug }).lean();
    if (exists) return res.status(409).json({ error: "slug already exists" });

    const payload = {
      title,
      slug: finalSlug,
      category,
      instructor,
      duration,
      level,
      description,
      bullets: Array.isArray(bullets) ? bullets : [],
      hero: normalizeImage(hero),
      gallery: normalizeGallery(gallery),
      price,
      isActive,
    };

    const created = await Workshop.create(payload);
    res.status(201).json(created);
  } catch (err) {
    console.error("createWorkshop error:", err);
    res.status(500).json({ error: "Failed to create workshop" });
  }
}

// PUT /workshops/:slug
export async function updateWorkshop(req, res) {
  try {
    const { slug } = req.params;
    const body = { ...req.body };

    if (body.slug || body.title) {
      // אפשר שינוי סלג אם מעוניינים
      body.slug = slugify(body.slug || body.title || slug);
    }
    if (typeof body.hero !== "undefined") body.hero = normalizeImage(body.hero);
    if (typeof body.gallery !== "undefined")
      body.gallery = normalizeGallery(body.gallery);
    if (typeof body.bullets !== "undefined" && !Array.isArray(body.bullets))
      body.bullets = [];

    const updated = await Workshop.findOneAndUpdate({ slug }, body, {
      new: true,
      runValidators: true,
    });

    if (!updated) return res.status(404).json({ error: "Workshop not found" });
    res.json(updated);
  } catch (err) {
    console.error("updateWorkshop error:", err);
    // 11000 = duplicate key (יכול לקרות אם משנים slug לקיים)
    if (err?.code === 11000) {
      return res.status(409).json({ error: "slug already exists" });
    }
    res.status(500).json({ error: "Failed to update workshop" });
  }
}

// DELETE /workshops/:slug
export async function deleteWorkshop(req, res) {
  try {
    const { slug } = req.params;
    const deleted = await Workshop.findOneAndDelete({ slug });
    if (!deleted) return res.status(404).json({ error: "Workshop not found" });
    res.json({ ok: true });
  } catch (err) {
    console.error("deleteWorkshop error:", err);
    res.status(500).json({ error: "Failed to delete workshop" });
  }
}
