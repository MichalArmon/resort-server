// controllers/roomController.js
import Room from "../models/Room.js";

const slugify = (s = "") =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

// GET /api/v1/rooms/types
export const getRoomTypes = async (req, res) => {
  try {
    const grouped = await Room.aggregate([
      { $group: { _id: "$roomType", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    const types = grouped.map((g) => {
      const label = g._id; // ex: "Standard Bungalow"
      const slug = slugify(label); // -> "standard-bungalow"
      return { label, type: slug, slug, count: g.count };
    });

    res.json(types);
  } catch (e) {
    console.error("getRoomTypes error:", e);
    res.status(500).json({ message: "Failed to fetch room types" });
  }
};

// GET /api/v1/rooms/:type
export const getRoomByType = async (req, res) => {
  try {
    const { type } = req.params; // slug, e.g. "standard-bungalow"
    if (!type) return res.status(400).json({ message: "type is required" });

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

    res.json({
      type, // slug
      label: title, // for display
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
    res.status(500).json({ message: "Failed to fetch room by type" });
  }
};
