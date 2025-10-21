// 📁 server/controllers/bookingController.js
import Booking from "../models/Booking.js";
import RoomType from "../models/Room.js"; // המודל שמייצג סוג חדר (עם stock)
import Retreat from "../models/Retreat.js";
import PricingRule from "../models/PricingRule.js"; // ✅ חישוב מחירים
import Workshop from "../models/Workshop.js"; // ✅ סדנאות (sessions/capacity)

/* ---------- Helpers (Cloudinary URLs + image normalization) ---------- */
const CLD = process.env.CLOUDINARY_CLOUD_NAME || "dhje7hbxd";
const cldUrl = (pid) =>
  pid
    ? `https://res.cloudinary.com/${CLD}/image/upload/f_auto,q_auto/${pid}`
    : null;

const toImgObj = (x) => {
  if (!x) return null;
  if (typeof x === "string") return { publicId: x, url: cldUrl(x) };
  const pid = x.public_id || x.publicId || null;
  const url = x.secure_url || x.url || cldUrl(pid);
  return { publicId: pid, url: url || null, alt: x.alt || "" };
};

/* ---------- Utils ---------- */
const mapTypeToRef = (type) => {
  switch (type) {
    case "room":
      return "Room";
    case "retreat":
      return "Retreat";
    case "treatment":
      return "Treatment";
    case "workshop":
      return "Workshop";
    default:
      return null;
  }
};

const pad = (n, w = 5) => String(n).padStart(w, "0");
const genBookingNumber = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rnd = pad(Math.floor(Math.random() * 99999));
  return `BT-${y}${m}${day}-${rnd}`;
};

const isValidObjectId = (id) => /^[0-9a-fA-F]{24}$/.test(id);

/* ---------- Quote helpers ---------- */
const MS_DAY = 1000 * 60 * 60 * 24;
const toStartOfDay = (d) => new Date(new Date(d).setHours(0, 0, 0, 0));
const nightsArray = (checkInDate, checkOutDate) => {
  const arr = [];
  let cur = toStartOfDay(checkInDate);
  const end = toStartOfDay(checkOutDate);
  while (cur < end) {
    arr.push(new Date(cur));
    cur = new Date(cur.getTime() + MS_DAY);
  }
  return arr;
};
const overlaps = (rule, date) => {
  const d = toStartOfDay(date).getTime();
  const start = toStartOfDay(rule.startDate).getTime();
  const endExclusive = toStartOfDay(rule.endDate).getTime() + MS_DAY; // כולל סוף היום
  return d >= start && d < endExclusive;
};

/* ==================================================================== */
/* =                         CHECK AVAILABILITY                        = */
/* ==================================================================== */
export const checkAvailability = async (req, res) => {
  const {
    checkIn,
    checkOut,
    guests,
    rooms,
    roomType: roomTypeParam, // יכול להיות slug או _id
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
    /* 0) אתר סגור בגלל ריטריט */
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

    /* 1) שליפת RoomTypes פעילים + סינון אופציונלי לפי roomType (slug או _id) */
    const typeFilter = {
      active: true,
      $or: [
        { maxGuests: { $gte: minCapacityPerRoom } },
        { maxGuests: { $exists: false } },
        { maxGuests: null },
      ],
    };

    if (roomTypeParam) {
      const maybeId = isValidObjectId(roomTypeParam) ? roomTypeParam : null;
      typeFilter.$and = [
        {
          $or: [
            { slug: roomTypeParam },
            maybeId ? { _id: maybeId } : null,
          ].filter(Boolean),
        },
      ];
    }

    const types = await RoomType.find(typeFilter).select(
      "slug title stock priceBase currency maxGuests hero images"
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

    /* 2) הזמנות חופפות (כולל Pending) — לפי הסכימה החדשה:
          משתמשים ב-Booking.type === "room" וסופרים לפי itemId (שהוא _id של RoomType) */
    const overlapping = await Booking.find({
      type: "room",
      status: { $in: ["Confirmed", "Pending"] },
      checkInDate: { $lt: checkOutDate },
      checkOutDate: { $gt: checkInDate },
    }).select("itemId"); // itemId מצביע ל-RoomType._id

    // מיפוי: roomTypeId -> כמה יחידות תפוסות
    const occupiedByTypeId = {};
    for (const b of overlapping) {
      const key = String(b.itemId || "");
      if (!key) continue;
      occupiedByTypeId[key] = (occupiedByTypeId[key] || 0) + 1;
    }

    /* 3) חישוב תקציר זמינות לפי stock */
    const summary = {};
    for (const t of types) {
      const typeId = String(t._id);
      const slug = t.slug;
      const totalStock = Math.max(0, Number(t.stock) || 0);
      const occupiedUnits = Math.max(0, occupiedByTypeId[typeId] || 0);
      const availableUnits = Math.max(0, totalStock - occupiedUnits);

      summary[slug] = {
        typeId,
        title: t.title,
        totalStock,
        occupiedUnits,
        availableUnits,
        currency: t.currency || "USD",
        priceBase: Number.isFinite(t.priceBase) ? t.priceBase : null,
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

    /* 4) רשימת הצעות ידידותית לפרונט (כולל תמונות) */
    const availableRooms = Object.entries(summary)
      .filter(([, s]) => s.availableUnits > 0)
      .map(([slug, s]) => {
        const t = types.find((x) => x.slug === slug);
        const hero = toImgObj(t?.hero);
        const firstImg = Array.isArray(t?.images)
          ? toImgObj(t.images[0])
          : null;

        return {
          _id: s.typeId, // מזהה ה-RoomType לשימוש ישיר ל-itemId בהזמנה
          slug,
          title: s.title,
          priceBase: s.priceBase,
          currency: s.currency || "USD",
          availableUnits: s.availableUnits,
          hero: hero,
          heroUrl: hero?.url || null,
          imageUrl: firstImg?.url || null,
        };
      });

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

/* ==================================================================== */
/* =                               QUOTE                               = */
/* ==================================================================== */
export const getQuote = async (req, res) => {
  try {
    const {
      type, // "room" | "retreat" | "treatment" | "workshop"
      itemId, // room: RoomType._id | workshop: Workshop._id
      checkInDate, // room
      checkOutDate, // room
      guestCount = 1,
      rooms = 1, // room units
      sessionId, // workshop
    } = req.body;

    if (!type) {
      return res.status(400).json({ message: "Missing booking type." });
    }

    /* ====== ROOM QUOTE ====== */
    if (type === "room") {
      if (!itemId || !checkInDate || !checkOutDate) {
        return res.status(400).json({
          message:
            "itemId, checkInDate and checkOutDate are required for room quote.",
        });
      }

      const rt = await RoomType.findById(itemId).select(
        "title slug priceBase currency stock active"
      );
      if (!rt || rt.active === false) {
        return res
          .status(404)
          .json({ message: "Room type not found or inactive." });
      }

      const checkIn = new Date(checkInDate);
      const checkOut = new Date(checkOutDate);
      if (!(checkIn < checkOut)) {
        return res.status(400).json({ message: "Invalid date range." });
      }

      const nights = nightsArray(checkIn, checkOut);
      if (nights.length === 0) {
        return res
          .status(400)
          .json({ message: "Stay must be at least 1 night." });
      }

      const identifiers = ["ALL", rt.slug, rt.title, String(rt._id)].filter(
        Boolean
      );
      const rules = await PricingRule.find({
        appliesTo: { $in: identifiers },
        startDate: { $lte: checkOut },
        endDate: { $gte: checkIn },
      }).sort({ startDate: 1 });

      const base = Number(rt.priceBase) || 0;
      const currency = rt.currency || "USD";

      let requiredMinStay = 1;
      const breakdown = nights.map((d) => {
        const activeRules = rules.filter((r) => overlaps(r, d));
        if (activeRules.length) {
          const maxMin = Math.max(...activeRules.map((r) => r.minStay || 1));
          requiredMinStay = Math.max(requiredMinStay, maxMin);
        }
        const multiplier = activeRules.reduce(
          (acc, r) => acc * (r.priceMultiplier || 1),
          1
        );
        const nightly = +(base * multiplier).toFixed(2);
        return {
          date: d.toISOString().slice(0, 10),
          base,
          multiplier,
          nightly,
          rules: activeRules.map((r) => ({
            name: r.name,
            appliesTo: r.appliesTo,
            priceMultiplier: r.priceMultiplier,
            minStay: r.minStay || 1,
            startDate: r.startDate,
            endDate: r.endDate,
          })),
        };
      });

      const nightsCount = nights.length;
      const perRoomSubtotal = breakdown.reduce((sum, d) => sum + d.nightly, 0);
      const total = +(perRoomSubtotal * rooms).toFixed(2);

      const payload = {
        type: "room",
        roomType: { id: String(rt._id), title: rt.title, slug: rt.slug },
        currency,
        rooms,
        nightsCount,
        requiredMinStay,
        minStayOk: nightsCount >= requiredMinStay,
        perRoomSubtotal: +perRoomSubtotal.toFixed(2),
        total,
        breakdown,
      };

      if (!payload.minStayOk) {
        payload.warning = `This period requires a minimum stay of ${requiredMinStay} night(s).`;
      }

      return res.status(200).json(payload);
    }

    /* ====== WORKSHOP QUOTE (single session) ====== */
    if (type === "workshop") {
      if (!itemId || !sessionId) {
        return res
          .status(400)
          .json({ message: "Missing 'itemId' (workshopId) or 'sessionId'." });
      }

      const wk = await Workshop.findById(itemId).lean();
      if (!wk) return res.status(404).json({ message: "Workshop not found." });

      const session = (wk.sessions || []).find(
        (s) => String(s._id) === String(sessionId)
      );
      if (!session)
        return res
          .status(404)
          .json({ message: "Session not found for this workshop." });

      const currency = wk.currency || "USD";
      const pricePerSession = Number(wk.pricePerSession) || 0;

      // Capacity snapshot (optional on quote)
      const taken = await Booking.countDocuments({
        type: "workshop",
        itemId,
        sessionId,
        status: { $in: ["Pending", "Confirmed"] },
      });
      const cap = Number(session.capacity) || 0; // 0 = unlimited
      const capacityOk = cap === 0 ? true : taken < cap;

      return res.status(200).json({
        type: "workshop",
        currency,
        total: pricePerSession,
        breakdown: [{ label: "Single session", amount: pricePerSession }],
        session: {
          id: String(session._id),
          date: session.date,
          timeStart: session.timeStart,
          timeEnd: session.timeEnd,
          capacity: cap,
          taken,
          capacityOk,
        },
      });
    }

    // PLACEHOLDER לסוגים אחרים
    return res.status(400).json({
      message:
        "Quote supports 'room' and 'workshop' (single session). For treatments/retreats, extend pricing rules and we'll add logic.",
    });
  } catch (err) {
    console.error("Error generating quote:", err);
    return res
      .status(500)
      .json({ message: "Server error during quote calculation." });
  }
};

/* ==================================================================== */
/* =                           CREATE BOOKING                          = */
/* ==================================================================== */
export const createBooking = async (req, res) => {
  try {
    const {
      type, // "room" | "retreat" | "treatment" | "workshop"
      itemId, // room: RoomType._id | workshop: Workshop._id
      checkInDate, // room
      checkOutDate, // room
      date, // other (event)
      time, // optional
      guestCount = 1,
      totalPrice,
      discount = 0,
      guestInfo, // { fullName, email, phone, notes }
      sessionId, // workshop
    } = req.body;

    if (!type || !["room", "retreat", "treatment", "workshop"].includes(type)) {
      return res.status(400).json({ message: "Invalid or missing 'type'." });
    }
    if (!itemId || !isValidObjectId(itemId)) {
      return res.status(400).json({ message: "Invalid or missing 'itemId'." });
    }
    if (!guestInfo?.fullName || !guestInfo?.email) {
      return res
        .status(400)
        .json({ message: "Missing guestInfo (name/email)." });
    }

    const typeRef = mapTypeToRef(type);
    if (!typeRef) {
      return res.status(400).json({ message: "Unsupported booking type." });
    }

    /* ====== WORKSHOP CREATE (single session) ====== */
    if (type === "workshop") {
      if (!sessionId || !isValidObjectId(sessionId)) {
        return res.status(400).json({
          message: "Missing or invalid 'sessionId' for workshop booking.",
        });
      }

      const wk = await Workshop.findById(itemId).lean();
      if (!wk) return res.status(404).json({ message: "Workshop not found." });

      const session = (wk.sessions || []).find(
        (s) => String(s._id) === String(sessionId)
      );
      if (!session)
        return res
          .status(404)
          .json({ message: "Session not found for this workshop." });

      // Real-time capacity check
      const taken = await Booking.countDocuments({
        type: "workshop",
        itemId,
        sessionId,
        status: { $in: ["Pending", "Confirmed"] },
      });
      const cap = Number(session.capacity) || 0;
      if (cap !== 0 && taken >= cap) {
        return res
          .status(409)
          .json({ message: "This session is fully booked." });
      }

      const bookingNumber = genBookingNumber();
      const finalPrice =
        typeof totalPrice === "number"
          ? totalPrice
          : Number(wk.pricePerSession) || 0;

      const bookingDoc = new Booking({
        type: "workshop",
        typeRef: "Workshop",
        itemId,
        sessionId,
        bookingNumber,
        guestInfo,
        guestCount,
        totalPrice: finalPrice,
        discount,
        status: "Pending",
        date: session.date,
        time: session.timeStart,
      });

      await bookingDoc.save();

      return res.status(201).json({
        message: "Workshop booking created.",
        booking: bookingDoc,
      });
    }

    /* ====== ROOM CREATE ====== */
    let parsedCheckIn = null;
    let parsedCheckOut = null;

    if (type === "room") {
      if (!checkInDate || !checkOutDate) {
        return res.status(400).json({
          message:
            "checkInDate and checkOutDate are required for room bookings.",
        });
      }
      parsedCheckIn = new Date(checkInDate);
      parsedCheckOut = new Date(checkOutDate);
      if (!(parsedCheckIn < parsedCheckOut)) {
        return res.status(400).json({ message: "Invalid date range." });
      }

      const roomType = await RoomType.findOne({
        _id: itemId,
        active: true,
      }).select("stock title slug");
      if (!roomType) {
        return res
          .status(404)
          .json({ message: "Room type not found or inactive." });
      }

      const overlapping = await Booking.countDocuments({
        type: "room",
        itemId,
        status: { $in: ["Confirmed", "Pending"] },
        checkInDate: { $lt: parsedCheckOut },
        checkOutDate: { $gt: parsedCheckIn },
      });

      const stock = Math.max(0, Number(roomType.stock) || 0);
      if (overlapping >= stock) {
        return res.status(409).json({
          message: `No availability for the selected room type (${roomType.title}) in these dates.`,
        });
      }
    }

    // ייצור הזמנה כללית לסוגים אחרים (retreat/treatment) או room אחרי בדיקות
    const bookingNumber = genBookingNumber();
    const bookingDoc = new Booking({
      type,
      typeRef,
      itemId,
      bookingNumber,
      guestInfo,
      guestCount,
      totalPrice,
      discount,
      status: "Pending",
      checkInDate: parsedCheckIn,
      checkOutDate: parsedCheckOut,
      date: date ? new Date(date) : undefined,
      time: time || undefined,
    });

    await bookingDoc.save();

    return res.status(201).json({
      message: "Booking request created.",
      booking: bookingDoc,
    });
  } catch (err) {
    console.error("Error creating booking:", err);
    return res
      .status(500)
      .json({ message: "Server error during booking creation." });
  }
};

/* ==================================================================== */
/* =                       USER / ADMIN LISTINGS                       = */
/* ==================================================================== */
export const getUsersBookings = async (req, res) => {
  try {
    const email = req.user?.email || req.query?.email;
    if (!email) {
      return res.status(400).json({
        message: "Missing email (no logged-in user and no ?email=...)",
      });
    }

    const bookings = await Booking.find({ "guestInfo.email": email }).sort({
      createdAt: -1,
    });

    return res.status(200).json({ bookings });
  } catch (err) {
    console.error("Error fetching user's bookings:", err);
    return res.status(500).json({ message: "Server error." });
  }
};

export const getAllBookings = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit, 10) || 20)
    );
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Booking.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Booking.countDocuments({}),
    ]);

    return res.status(200).json({
      total,
      page,
      pages: Math.ceil(total / limit),
      items,
    });
  } catch (err) {
    console.error("Error fetching all bookings:", err);
    return res.status(500).json({ message: "Server error." });
  }
};

export const updateBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, totalPrice, discount, notes } = req.body;

    const allowedStatuses = ["Pending", "Confirmed", "Canceled"];
    const update = {};

    if (status) {
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status." });
      }
      update.status = status;
    }
    if (typeof totalPrice === "number") update.totalPrice = totalPrice;
    if (typeof discount === "number") update.discount = discount;
    if (notes) update["guestInfo.notes"] = notes;

    const updated = await Booking.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res.status(404).json({ message: "Booking not found." });
    }

    return res
      .status(200)
      .json({ message: "Booking updated.", booking: updated });
  } catch (err) {
    console.error("Error updating booking:", err);
    return res.status(500).json({ message: "Server error." });
  }
};
