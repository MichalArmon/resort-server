// controllers/roomController.js
import Room from "../models/Room.js";
import RoomType from "../models/RoomType.js";

const slugify = (s = "") =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

/** מחשב מלאי בפועל:
 *  1) מנסה לספור מסמכי Room לפי slug (או לפי title אם כך נשמר אצלך)
 *  2) אם אין מסמכי Room – חוזר ל-roomType.stock
 */
async function resolveStock(roomTypeDoc) {
  const slug = roomTypeDoc.slug || slugify(roomTypeDoc.title || "");
  // אם אצלך בשדה Room.roomType נשמר ה-slug:
  let n = await Room.countDocuments({ roomType: slug });
  if (n === 0) {
    // ייתכן שאצלך נשמר ה-title בתוך Room.roomType (לפי הקוד הישן)
    n = await Room.countDocuments({ roomType: roomTypeDoc.title });
  }
  return n > 0 ? n : roomTypeDoc.stock ?? 0;
}

/** GET /api/v1/rooms/types
 *  מחזיר רשימת סוגי חדרים עם stock מחושב + כל השדות לתצוגה
 */
export const getRoomTypes = async (req, res) => {
  try {
    const types = await RoomType.find({ active: true }).lean();

    // מחשבים מלאי לכל סוג במקביל
    const enriched = await Promise.all(
      types.map(async (t) => {
        const slug = t.slug || slugify(t.title || "");
        const stock = await resolveStock(t);
        return {
          label: t.title,
          type: slug,
          slug,
          count: stock, // 👈 מלאי אמיתי
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
      })
    );

    res.json(enriched);
  } catch (e) {
    console.error("getRoomTypes error:", e);
    res.status(500).json({ message: "Failed to fetch room types" });
  }
};

/** GET /api/v1/rooms/:type
 *  מחזיר אובייקט מלא של סוג חדר (כולל stock)
 */
export const getRoomByType = async (req, res) => {
  try {
    const { type } = req.params; // slug
    if (!type) return res.status(400).json({ message: "type is required" });

    const roomType = await RoomType.findOne({
      slug: type,
      active: true,
    }).lean();
    if (!roomType)
      return res.status(404).json({ message: "Room type not found" });

    const stock = await resolveStock(roomType);
    const title = roomType.title;
    const hero = roomType.hero || null;
    const gallery = roomType.images?.length
      ? roomType.images
      : hero
      ? [hero]
      : [];

    res.json({
      type,
      label: title,
      title,
      subtitle: "",
      hero,
      gallery,
      features: roomType.features || [],
      maxGuests: roomType.maxGuests ?? null,
      sizeM2: roomType.sizeM2 ?? null,
      bedType: roomType.bedType || null,
      priceBase: roomType.priceBase ?? null,
      currency: roomType.currency || "USD",
      stock, // 👈 מלאי בפועל
      raw: roomType,
    });
  } catch (e) {
    console.error("getRoomByType error:", e);
    res.status(500).json({ message: "Failed to fetch room by type" });
  }
};
