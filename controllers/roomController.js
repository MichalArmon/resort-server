// 📁 server/controllers/roomsController.js
import Room from "../models/Room.js";
import Booking from "../models/Booking.js";

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
   📜 GET — All rooms
   ============================================================ */
export const getRooms = async (_req, res) => {
  try {
    const docs = await Room.find({}).lean();
    res.json(docs.map(toUI));
  } catch (e) {
    console.error("getRooms error:", e);
    res.status(500).json({ message: "Failed to fetch rooms" });
  }
};

/* ============================================================
   📘 GET — By slug (for guests)
   ============================================================ */
export const getRoomBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    if (!slug) return res.status(400).json({ message: "slug is required" });

    const room = await Room.findOne({ slug, active: true });
    if (!room) return res.status(404).json({ message: "Room not found" });

    res.json(toUI(room));
  } catch (e) {
    console.error("getRoomBySlug error:", e);
    res.status(500).json({ message: "Failed to fetch room by slug" });
  }
};

/* ============================================================
   📗 GET — By ID (for admin)
   ============================================================ */
export const getRoomById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: "Missing ID" });

    const room = await Room.findById(id);
    if (!room) return res.status(404).json({ message: "Room not found" });

    res.json(toUI(room));
  } catch (e) {
    console.error("getRoomById error:", e);
    res.status(500).json({ message: "Failed to fetch room by ID" });
  }
};

/* ============================================================
   ➕ POST — Create new room
   ============================================================ */
export const createRoom = async (req, res) => {
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

    const created = await Room.create(payload);
    res.status(201).json(toUI(created));
  } catch (e) {
    console.error("createRoom error:", e);
    res.status(500).json({ message: "Failed to create room" });
  }
};

/* ============================================================
   ✏️ PUT — Update by ID (for admin)
   ============================================================ */
export const updateRoomById = async (req, res) => {
  try {
    const { id } = req.params;
    const room = await Room.findById(id);
    if (!room) return res.status(404).json({ message: "Room not found" });

    const body = req.body;

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
    console.error("updateRoomById error:", e);
    res
      .status(500)
      .json({ message: "Failed to update room", error: e.message });
  }
};

/* ============================================================
   ❌ DELETE — By ID (for admin)
   ============================================================ */
export const deleteRoomById = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await Room.findByIdAndDelete(id);
    if (!doc) return res.status(404).json({ message: "Room not found" });
    res.status(204).end();
  } catch (e) {
    console.error("deleteRoomById error:", e);
    res.status(500).json({ message: "Failed to delete room" });
  }
};
/* ============================================================
   🏨 GET — Availability check for rooms
   ============================================================ */
export const checkAvailability = async (req, res) => {
  try {
    const {
      checkIn,
      checkOut,
      guests,
      rooms,
      roomType: roomTypeParam,
    } = req.query;

    if (!checkIn || !checkOut || !guests || !rooms) {
      return res.status(400).json({
        message: "Check-in, Check-out, guests, and rooms are required.",
      });
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const requiredGuests = parseInt(guests, 10);
    const requiredRooms = parseInt(rooms, 10);
    const minCapacityPerRoom = Math.ceil(requiredGuests / requiredRooms);

    /* ----------------------------------------
       1) Filter rooms by capacity / type / active
       ---------------------------------------- */
    const filter = {
      active: true,
      $or: [
        { maxGuests: { $gte: minCapacityPerRoom } },
        { maxGuests: { $exists: false } },
        { maxGuests: null },
      ],
    };

    if (roomTypeParam) {
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(roomTypeParam);
      filter.$and = [
        {
          $or: [
            { slug: roomTypeParam },
            isObjectId ? { _id: roomTypeParam } : null,
          ].filter(Boolean),
        },
      ];
    }

    const roomDocs = await Room.find(filter).select(
      "slug title stock priceBase currency maxGuests hero images"
    );

    if (!roomDocs?.length) {
      return res.status(200).json({
        availableRooms: [],
        message: "No available room types found.",
      });
    }

    /* ----------------------------------------
       2) Find overlapping bookings
       ---------------------------------------- */
    const overlapping = await Booking.find({
      type: "room",
      status: { $in: ["Confirmed", "Pending"] },
      checkInDate: { $lt: checkOutDate },
      checkOutDate: { $gt: checkInDate },
    }).select("itemId");

    const occupiedByRoomId = {};
    for (const b of overlapping) {
      const key = String(b.itemId || "");
      occupiedByRoomId[key] = (occupiedByRoomId[key] || 0) + 1;
    }

    /* ----------------------------------------
       3) Build summary per room type
       ---------------------------------------- */
    const summary = {};
    for (const r of roomDocs) {
      const roomId = String(r._id);
      const slug = r.slug;
      const totalStock = Math.max(0, Number(r.stock) || 0);
      const occupiedUnits = Math.max(0, occupiedByRoomId[roomId] || 0);
      const availableUnits = Math.max(0, totalStock - occupiedUnits);

      summary[slug] = {
        roomId,
        title: r.title,
        totalStock,
        occupiedUnits,
        availableUnits,
        currency: r.currency || "USD",
        priceBase: Number.isFinite(r.priceBase) ? r.priceBase : null,
      };
    }

    /* ----------------------------------------
       4) Format UI results
       ---------------------------------------- */
    const availableRooms = Object.entries(summary)
      .filter(([, s]) => s.availableUnits > 0)
      .map(([slug, s]) => {
        const r = roomDocs.find((x) => x.slug === slug);
        const hero = toImgObj(r?.hero);
        const firstImg =
          Array.isArray(r?.images) && r.images.length
            ? toImgObj(r.images[0])
            : null;

        return {
          _id: s.roomId,
          slug,
          title: s.title,
          priceBase: s.priceBase,
          currency: s.currency,
          availableUnits: s.availableUnits,
          heroUrl: hero?.url || firstImg?.url || null,
        };
      });

    return res.status(200).json({
      checkIn: checkInDate,
      checkOut: checkOutDate,
      availableRooms,
      summary,
    });
  } catch (err) {
    console.error("Error fetching availability:", err);
    return res.status(500).json({
      message: "Server error during availability check.",
    });
  }
};
