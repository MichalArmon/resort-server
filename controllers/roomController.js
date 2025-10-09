import RoomType from "../models/Room.js";

const slugify = (s = "") =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

// GET /api/v1/rooms/types
export const getRoomTypes = async (_req, res) => {
  try {
    const docs = await RoomType.find({ active: true }).lean();
    const out = docs.map((t) => {
      const slug = t.slug || slugify(t.title || "");
      return {
        label: t.title,
        type: slug,
        slug,
        count: t.stock ?? 0, // משתמשים ב-stock מתוך המסמך
        hero: t.hero || null,
        images: t.images || [],
        features: t.features || [],
        maxGuests: t.maxGuests ?? null,
        sizeM2: t.sizeM2 ?? null,
        bedType: t.bedType || null,
        priceBase: t.priceBase ?? null,
        currency: t.currency || "USD",
        active: t.active !== false,
      };
    });
    res.json(out);
  } catch (e) {
    console.error("getRoomTypes error:", e);
    res.status(500).json({ message: "Failed to fetch room types" });
  }
};

// GET /api/v1/rooms/:type
export const getRoomByType = async (req, res) => {
  try {
    const { type } = req.params; // slug
    if (!type) return res.status(400).json({ message: "type is required" });

    const rt = await RoomType.findOne({ slug: type, active: true }).lean();
    if (!rt) return res.status(404).json({ message: "Room type not found" });

    const slug = rt.slug || slugify(rt.title || "");
    const hero = rt.hero || null;
    const gallery = rt.images?.length ? rt.images : hero ? [hero] : [];

    res.json({
      type: slug,
      label: rt.title,
      title: rt.title,
      subtitle: "",
      hero,
      gallery,
      features: rt.features || [],
      maxGuests: rt.maxGuests ?? null,
      sizeM2: rt.sizeM2 ?? null,
      bedType: rt.bedType || null,
      priceBase: rt.priceBase ?? null,
      currency: rt.currency || "USD",
      stock: rt.stock ?? 0,
      raw: rt,
    });
  } catch (e) {
    console.error("getRoomByType error:", e);
    res.status(500).json({ message: "Failed to fetch room by type" });
  }
};
