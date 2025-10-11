// controllers/booking.controller.js
import Booking from "../models/Booking.js";
import RoomType from "../models/Room.js"; // 👈 חשוב: להשתמש ב-RoomType
import Retreat from "../models/Retreat.js";

export const checkAvailability = async (req, res) => {
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

  try {
    // 0) סגירה בגלל ריטריט
    const closedRetreat = await Retreat.findOne({
      isClosed: true,
      startDate: { $lt: checkOutDate },
      endDate: { $gt: checkInDate },
    });
    if (closedRetreat) {
      return res.status(200).json({
        availableRooms: [],
        summary: {},
        message: `The resort is closed for ${closedRetreat.name} in these dates.`,
      });
    }

    // 1) סינון סוגי חדרים (סלחני ל-maxGuests חסר), ותמיכה ב-roomType כ-slug או _id
    const typeFilter = {
      active: true,
      $or: [
        { maxGuests: { $gte: minCapacityPerRoom } },
        { maxGuests: { $exists: false } },
        { maxGuests: null },
      ],
    };
    if (roomTypeParam) {
      typeFilter.$and = [
        {
          $or: [
            { slug: roomTypeParam },
            /^[0-9a-fA-F]{24}$/.test(roomTypeParam)
              ? { _id: roomTypeParam }
              : null,
          ].filter(Boolean),
        },
      ];
    }

    const types = await RoomType.find(typeFilter).select(
      "slug title stock priceBase currency maxGuests"
    );

    // דיבוג (להסרה אחרי בדיקה)
    console.log("[AVAIL] filter:", typeFilter);
    console.log(
      "[AVAIL] found types:",
      types.map((t) => ({
        slug: t.slug,
        title: t.title,
        stock: t.stock,
        maxGuests: t.maxGuests,
      }))
    );

    if (!types?.length) {
      return res.status(200).json({
        checkIn: checkInDate,
        checkOut: checkOutDate,
        availableRooms: [],
        summary: {},
        message: `Only 0 units available; you requested ${requiredRooms}.`,
      });
    }

    // 2) הזמנות חופפות (כולל Pending למניעת דאבל־בוקינג)
    const overlapping = await Booking.find({
      status: { $in: ["Confirmed", "Pending"] },
      checkInDate: { $lt: checkOutDate },
      checkOutDate: { $gt: checkInDate },
    }).select("bookedRoomType bookedRoomTypeSlug");

    const occupiedBySlug = {};
    for (const b of overlapping) {
      const key =
        b.bookedRoomTypeSlug ||
        (typeof b.bookedRoomType === "object" && b.bookedRoomType?.slug) ||
        (typeof b.bookedRoomType === "string" ? b.bookedRoomType : null);
      if (!key) continue;
      occupiedBySlug[key] = (occupiedBySlug[key] || 0) + 1;
    }

    // 3) תקציר לפי stock
    const summary = {};
    for (const t of types) {
      const slug = t.slug;
      const totalStock = Math.max(0, t.stock || 0);
      const occupiedUnits = Math.max(0, occupiedBySlug[slug] || 0);
      const availableUnits = Math.max(0, totalStock - occupiedUnits);

      summary[slug] = {
        title: t.title,
        totalStock,
        occupiedUnits,
        availableUnits,
        currency: t.currency || "USD",
        priceBase: t.priceBase ?? null,
      };
    }

    const totalAvailableUnits = Object.values(summary).reduce(
      (acc, s) => acc + (s.availableUnits || 0),
      0
    );

    if (totalAvailableUnits < requiredRooms) {
      return res.status(200).json({
        checkIn: checkInDate,
        checkOut: checkOutDate,
        availableRooms: [],
        summary,
        message: `Only ${totalAvailableUnits} units available; you requested ${requiredRooms}.`,
      });
    }

    const availableRooms = Object.entries(summary)
      .filter(([, s]) => s.availableUnits > 0)
      .map(([slug, s]) => ({
        _id: slug,
        slug,
        title: s.title,
        priceBase: s.priceBase,
        currency: s.currency || "USD",
        availableUnits: s.availableUnits,
      }));

    return res.status(200).json({
      checkIn: checkInDate,
      checkOut: checkOutDate,
      availableRooms,
      summary,
      message: `Found ${totalAvailableUnits} units available.`,
    });
  } catch (err) {
    console.error("Error fetching availability:", err);
    return res
      .status(500)
      .json({ message: "Server error during availability check." });
  }
};
