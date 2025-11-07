// 📁 server/controllers/bookingController.js
import Booking from "../models/Booking.js";
import RoomType from "../models/Room.js";
import Retreat from "../models/Retreat.js";
import Workshop from "../models/Workshop.js";
import Treatment from "../models/Treatment.js";
import PricingRule from "../models/PricingRule.js";
import User from "../models/User.js";
import nodemailer from "nodemailer";

/* ---------- Helpers ---------- */
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

/* ---------- Date utils ---------- */
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

/* ==================================================================== */
/* =                         CHECK AVAILABILITY                        = */
/* ==================================================================== */
export const checkAvailability = async (req, res) => {
  try {
    const {
      checkIn,
      checkOut,
      guests,
      rooms,
      roomType: roomTypeParam,
    } = req.query;
    if (!checkIn || !checkOut || !guests || !rooms)
      return res.status(400).json({
        message: "Check-in, Check-out, guests, and rooms are required.",
      });

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const requiredGuests = parseInt(guests, 10);
    const requiredRooms = parseInt(rooms, 10);
    const minCapacityPerRoom = Math.ceil(requiredGuests / requiredRooms);

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
    if (!types?.length)
      return res.status(200).json({
        availableRooms: [],
        message: `No available room types found.`,
      });

    const overlapping = await Booking.find({
      type: "room",
      status: { $in: ["Confirmed", "Pending"] },
      checkInDate: { $lt: checkOutDate },
      checkOutDate: { $gt: checkInDate },
    }).select("itemId");

    const occupiedByTypeId = {};
    for (const b of overlapping) {
      const key = String(b.itemId || "");
      occupiedByTypeId[key] = (occupiedByTypeId[key] || 0) + 1;
    }

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

    const availableRooms = Object.entries(summary)
      .filter(([, s]) => s.availableUnits > 0)
      .map(([slug, s]) => {
        const t = types.find((x) => x.slug === slug);
        const hero = toImgObj(t?.hero);
        const firstImg = Array.isArray(t?.images)
          ? toImgObj(t.images[0])
          : null;
        return {
          _id: s.typeId,
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
      type,
      itemId,
      checkInDate,
      checkOutDate,
      guestCount = 1,
      rooms = 1,
    } = req.body;

    if (!type) return res.status(400).json({ message: "Missing type." });

    if (type === "room") {
      const rt = await RoomType.findById(itemId).select(
        "title slug priceBase currency stock active"
      );
      if (!rt) return res.status(404).json({ message: "Room type not found." });

      const checkIn = new Date(checkInDate);
      const checkOut = new Date(checkOutDate);
      const nights = nightsArray(checkIn, checkOut);
      const base = Number(rt.priceBase) || 0;
      const total = +(base * nights.length * rooms).toFixed(2);

      return res.status(200).json({
        type,
        nights: nights.length,
        total,
        currency: rt.currency || "USD",
        breakdown: nights.map((n) => ({
          date: n,
          nightly: base,
        })),
      });
    }

    return res.status(400).json({ message: "Unsupported type for quote." });
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
      type,
      itemId,
      checkInDate,
      checkOutDate,
      date,
      time,
      guestCount = 1,
      totalPrice,
      guestInfo,
      sessionId,
    } = req.body;

    if (!type || !itemId || !guestInfo?.fullName || !guestInfo?.email)
      return res
        .status(400)
        .json({ message: "Missing required booking parameters." });

    const typeRef = mapTypeToRef(type);
    const bookingNumber = genBookingNumber();

    // 🧩 1️⃣ חיפוש/יצירת יוזר לפי האימייל של האורח
    let user = await User.findOne({ email: guestInfo.email });
    if (!user) {
      const randomPassword = Math.random().toString(36).slice(-8);
      user = await User.create({
        email: guestInfo.email,
        password: randomPassword,
        role: "user",
        loginType: "local",
      });
      console.log("✨ Created new user from booking:", user.email);
    }

    // 🧾 2️⃣ יצירת ההזמנה עם קישור ליוזר
    const bookingDoc = new Booking({
      type,
      typeRef,
      itemId,
      bookingNumber,
      guestInfo,
      guestCount,
      totalPrice,
      status: "Confirmed",
      checkInDate,
      checkOutDate,
      date,
      time,
      sessionId,
      user: user._id,
    });

    await bookingDoc.save();
    console.log("✅ Booking created:", bookingNumber);

    // 🏨 3️⃣ עדכון מלאי
    try {
      if (type === "room") {
        await RoomType.findByIdAndUpdate(itemId, { $inc: { stock: -1 } });
      } else if (type === "workshop") {
        const workshop = await Workshop.findById(itemId);
        if (workshop && Array.isArray(workshop.sessions)) {
          const index = workshop.sessions.findIndex(
            (s) => String(s._id) === String(sessionId)
          );
          if (index >= 0) {
            workshop.sessions[index].capacity =
              (workshop.sessions[index].capacity || 0) - guestCount;
            await workshop.save();
          }
        }
      } else if (type === "retreat") {
        await Retreat.findByIdAndUpdate(itemId, {
          $inc: { capacity: -guestCount },
        });
      }
      console.log("📦 Capacity updated for:", type);
    } catch (err) {
      console.warn("⚠️ Capacity update failed:", err.message);
    }

    // 📧 4️⃣ שליחת מייל ללקוח
    try {
      console.log("📧 Sending confirmation to:", guestInfo.email);
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_PASS,
        },
      });

      const htmlEmail = `
      <div style="font-family: Arial; background-color: #f6f9f8; padding: 40px;">
        <table width="100%" style="max-width:600px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;">
          <tr><td style="background:#22615C;color:#fff;text-align:center;padding:20px;">
            <h2>Ban Tao Resort</h2>
          </td></tr>
          <tr><td style="padding:24px;color:#333;">
            <h3>Thank you, ${guestInfo.fullName} 🌴</h3>
            <p>Your booking <b>#${bookingNumber}</b> is confirmed.</p>
            <p><b>Type:</b> ${type}</p>
            ${
              checkInDate
                ? `<p><b>Check-in:</b> ${new Date(
                    checkInDate
                  ).toLocaleDateString()}</p>`
                : ""
            }
            ${
              checkOutDate
                ? `<p><b>Check-out:</b> ${new Date(
                    checkOutDate
                  ).toLocaleDateString()}</p>`
                : ""
            }
            <p><b>Total Price:</b> ${totalPrice || "TBD"} ฿</p>
          </td></tr>
        </table>
      </div>`;

      await transporter.sendMail({
        from: `"Ban Tao Resort" <${process.env.GMAIL_USER}>`,
        to: guestInfo.email,
        subject: `🌴 Booking Confirmation (${bookingNumber})`,
        html: htmlEmail,
      });

      console.log("✅ Email sent successfully.");
    } catch (err) {
      console.error("❌ Email send error:", err.message);
    }

    return res.status(201).json({
      message: "Booking created successfully",
      booking: bookingDoc,
      user,
    });
  } catch (err) {
    console.error("Error creating booking:", err);
    return res.status(500).json({ message: "Server error during booking." });
  }
};

/* ==================================================================== */
/* =                       USER / ADMIN LISTINGS                       = */
/* ==================================================================== */
export const getUsersBookings = async (req, res) => {
  try {
    const email = req.user?.email || req.query?.email;
    if (!email)
      return res
        .status(400)
        .json({ message: "Missing email (no logged-in user)." });

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
    const items = await Booking.find({})
      .sort({ createdAt: -1 })
      .populate("itemId", "title slug")
      .lean();
    console.log(`📋 ${items.length} bookings fetched for admin`);
    return res.status(200).json(items);
  } catch (err) {
    console.error("Error fetching all bookings:", err);
    return res.status(500).json({ message: "Server error." });
  }
};

export const updateBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const allowedStatuses = ["Pending", "Confirmed", "Canceled"];
    if (status && !allowedStatuses.includes(status))
      return res.status(400).json({ message: "Invalid status." });

    const updated = await Booking.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );
    if (!updated)
      return res.status(404).json({ message: "Booking not found." });

    console.log(`🔄 Booking ${updated.bookingNumber} → ${updated.status}`);
    return res
      .status(200)
      .json({ message: "Booking updated.", booking: updated });
  } catch (err) {
    console.error("Error updating booking:", err);
    return res.status(500).json({ message: "Server error." });
  }
};
