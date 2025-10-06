import Room from "../models/Room";

// controllers/rooms.controller.js

/** helper: ממיר מחרוזת ל-slug */
const slugify = (s = "") =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

/** GET /api/v1/rooms/types
 * מחזיר רשימת סוגים ייחודיים בפורמט {label, type, slug, count}
 */
export const getRoomTypes = async (req, res) => {
  try {
    const grouped = await Room.aggregate([
      { $group: { _id: "$roomType", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    const types = grouped.map((g) => {
      const label = g._id; // לדוגמה: "Deluxe Villa"
      const slug = slugify(label); // -> "deluxe-villa"
      return { label, type: slug, slug, count: g.count };
    });

    return res.json(types);
  } catch (e) {
    console.error("getRoomTypes error:", e);
    return res.status(500).json({ message: "Failed to fetch room types" });
  }
};

/** GET /api/v1/rooms/:type
 * מחזיר נתוני חדר “עשירים” לפי סוג (type=slug של roomType)
 * הערה: כאן מחזירים חדר אחד מייצג מהסוג. אם תרצי רשימה — ראו ההערה למטה.
 */
export const getRoomByType = async (req, res) => {
  try {
    const { type } = req.params; // למשל "standard-bungalow"
    if (!type) return res.status(400).json({ message: "type is required" });

    // מביאים רק את השדות הנדרשים ומממשים slugify
    const docs = await Room.find({}, { __v: 0 }).lean();
    const match = docs.find((r) => slugify(r.roomType) === type);

    if (!match) return res.status(404).json({ message: "Room type not found" });

    const title = match.roomType;
    const subtitle = match.roomName || "";
    const hero = match.imageURL;
    const gallery = [match.imageURL];
    const features = [
      `${match.capacity} guests`,
      `Base price: ${match.basePrice}`,
      ...(Array.isArray(match.amenities) ? match.amenities : []),
    ];

    return res.json({
      type, // slug
      label: title,
      title,
      subtitle,
      hero,
      gallery,
      features,
      raw: {
        id: match._id,
        roomName: match.roomName,
        roomType: match.roomType,
        capacity: match.capacity,
        basePrice: match.basePrice,
        amenities: match.amenities,
        imageURL: match.imageURL,
      },
    });
  } catch (e) {
    console.error("getRoomByType error:", e);
    return res.status(500).json({ message: "Failed to fetch room by type" });
  }
};

/* ========= אופציונלי: אם תרצי להחזיר רשימת כל החדרים עבור סוג =========
export const getRoomsListByType = async (req, res) => {
  try {
    const { type } = req.params;
    const docs = await Room.find({}).lean();
    const list = docs.filter(r => slugify(r.roomType) === type);
    if (!list.length) return res.status(404).json({ message: "Room type not found" });
    return res.json({
      type,
      count: list.length,
      rooms: list.map(r => ({
        id: r._id, roomName: r.roomName, capacity: r.capacity,
        basePrice: r.basePrice, amenities: r.amenities, imageURL: r.imageURL
      }))
    });
  } catch (e) {
    return res.status(500).json({ message: "Failed to fetch rooms list" });
  }
};
*/
