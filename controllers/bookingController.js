// 📁 server/controllers/bookingController.js
import { Resend } from "resend";
import Booking from "../models/Booking.js";
import RoomType from "../models/Room.js";
import Retreat from "../models/Retreat.js";
import Workshop from "../models/Workshop.js";
import Treatment from "../models/Treatment.js";
import PricingRule from "../models/PricingRule.js";
import User from "../models/User.js";
import Session from "../models/Session.js";
import nodemailer from "nodemailer";
import moment from "moment-timezone";

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
/* =                             QUOTE                                 = */
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

    try {
      if (type === "room") {
        await RoomType.findByIdAndUpdate(itemId, { $inc: { stock: -1 } });
      } else if (type === "workshop") {
        if (sessionId) {
          const s = await Session.findById(sessionId).select(
            "capacity bookedCount"
          );
          if (!s || s.capacity - s.bookedCount < guestCount) {
            throw new Error(`Seats not available or session not found.`);
          }
          const updateResult = await Session.findByIdAndUpdate(
            sessionId,
            { $inc: { bookedCount: guestCount } },
            { new: true }
          );
          if (updateResult && updateResult.bookedCount >= updateResult.capacity)
            await Session.findByIdAndUpdate(sessionId, { status: "full" });
        }
      } else if (type === "retreat") {
        await Retreat.findByIdAndUpdate(itemId, {
          $inc: { capacity: -guestCount },
        });
      }
      console.log("📦 Capacity updated for:", type);
    } catch (err) {
      console.warn("⚠️ Capacity update failed:", err.message);
      await Booking.deleteOne({ _id: bookingDoc._id });
      return res
        .status(400)
        .json({ message: err.message || "Failed to reserve seats." });
    }

    /* ========== EMAIL SECTION (Resend or Gmail) ========== */
    try {
      console.log("📧 Sending confirmation to:", guestInfo.email);

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

      if (process.env.RESEND_API_KEY) {
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: "Ban Tao <no-reply@resend.dev>",
          to: guestInfo.email,
          subject: `🌴 Booking Confirmation (${bookingNumber})`,
          html: htmlEmail,
        });
        console.log("✅ Email sent successfully via Resend");
      } else {
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_PASS,
          },
        });

        await transporter.sendMail({
          from: `"Ban Tao Resort" <${process.env.GMAIL_USER}>`,
          to: guestInfo.email,
          subject: `🌴 Booking Confirmation (${bookingNumber})`,
          html: htmlEmail,
        });
        console.log("✅ Email sent successfully via Gmail");
      }
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
/* =                         USER / ADMIN LISTINGS                     = */
/* ==================================================================== */
export const getUsersBookings = async (req, res) => {
  // ... נשאר ללא שינוי
};

export const getAllBookings = async (req, res) => {
  // ... נשאר ללא שינוי
};

export const updateBooking = async (req, res) => {
  // ... נשאר ללא שינוי
};

/* ==================================================================== */
/* =                           CANCEL BOOKING                          = */
/* ==================================================================== */
export const cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await Booking.findById(id);
    if (!booking)
      return res.status(404).json({ message: "Booking not found." });
    if (booking.status === "Cancelled")
      return res.status(200).json({ message: "Booking already cancelled." });

    try {
      if (booking.type === "room") {
        await RoomType.findByIdAndUpdate(booking.itemId, {
          $inc: { stock: 1 },
        });
      } else if (booking.type === "workshop" && booking.sessionId) {
        const s = await Session.findByIdAndUpdate(
          booking.sessionId,
          { $inc: { bookedCount: -booking.guestCount } },
          { new: true }
        );
        if (s && s.status === "full" && s.bookedCount < s.capacity)
          await Session.findByIdAndUpdate(booking.sessionId, {
            status: "scheduled",
          });
      } else if (booking.type === "retreat") {
        await Retreat.findByIdAndUpdate(booking.itemId, {
          $inc: { capacity: booking.guestCount },
        });
      }
      console.log(`📦 Capacity restored for ${booking.type}`);
    } catch (err) {
      console.warn("⚠️ Capacity restore failed:", err.message);
    }

    booking.status = "Cancelled";
    await booking.save();

    try {
      const htmlEmail = `
        <div style="font-family: Arial; background-color: #f6f9f8; padding: 40px;">
          <table width="100%" style="max-width:600px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;">
            <tr><td style="background:#b23b3b;color:#fff;text-align:center;padding:20px;">
              <h2>Ban Tao Resort</h2>
            </td></tr>
            <tr><td style="padding:24px;color:#333;">
              <h3>Hi ${booking.guestInfo.fullName},</h3>
              <p>Your booking <b>#${booking.bookingNumber}</b> has been cancelled.</p>
              <p>We hope to see you again soon 🌿</p>
            </td></tr>
          </table>
        </div>`;

      if (process.env.RESEND_API_KEY) {
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: "Ban Tao <no-reply@resend.dev>",
          to: booking.guestInfo.email,
          subject: `❌ Booking Cancellation (${booking.bookingNumber})`,
          html: htmlEmail,
        });
        console.log("✅ Cancellation email sent via Resend");
      } else {
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_PASS,
          },
        });

        await transporter.sendMail({
          from: `"Ban Tao Resort" <${process.env.GMAIL_USER}>`,
          to: booking.guestInfo.email,
          subject: `❌ Booking Cancellation (${booking.bookingNumber})`,
          html: htmlEmail,
        });
        console.log("✅ Cancellation email sent via Gmail");
      }
    } catch (err) {
      console.warn("⚠️ Email cancel send error:", err.message);
    }

    return res
      .status(200)
      .json({ message: "Booking cancelled successfully", booking });
  } catch (err) {
    console.error("❌ Error cancelling booking:", err);
    return res
      .status(500)
      .json({ message: "Server error during cancellation." });
  }
};
