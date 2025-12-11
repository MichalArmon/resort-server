// 📁 server/controllers/bookingController.js
import { Resend } from "resend";
import Booking from "../models/Booking.js";
import Room from "../models/Room.js";
import Retreat from "../models/Retreat.js";
import Workshop from "../models/Workshop.js";
import Treatment from "../models/Treatment.js";
import PricingRule from "../models/PricingRule.js";
import Session from "../models/Session.js";
import nodemailer from "nodemailer";
import moment from "moment-timezone";

/* ---------- Helpers ---------- */
const CLOUDINARY_NAME = process.env.CLOUDINARY_CLOUD_NAME || "dhje7hbxd";

const buildCloudinaryUrl = (publicId) => {
  if (!publicId) return null;
  return `https://res.cloudinary.com/${CLOUDINARY_NAME}/image/upload/f_auto,q_auto/${publicId}`;
};

const normalizeImageObject = (image) => {
  if (!image) return null;

  if (typeof image === "string") {
    return {
      publicId: image,
      url: buildCloudinaryUrl(image),
      alt: "",
    };
  }

  const publicId = image.public_id || image.publicId || null;
  const url = image.secure_url || image.url || buildCloudinaryUrl(publicId);

  return {
    publicId,
    url: url || null,
    alt: image.alt || "",
  };
};

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
    const { checkIn, checkOut, guests, rooms } = req.query;

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

    // שימוש ב־Room (לא RoomType)
    const types = await Room.find(typeFilter).select(
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
        const hero = normalizeImageObject(t?.hero);
        const firstImg = Array.isArray(t?.images)
          ? normalizeImageObject(t.images[0])
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
    return res.status(500).json({
      message: "Server error during availability check.",
    });
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
      const rt = await Room.findById(itemId).select(
        "title slug priceBase currency stock active"
      );
      if (!rt) return res.status(404).json({ message: "Room not found." });

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
    return res.status(500).json({
      message: "Server error during quote calculation.",
    });
  }
};

/* ==================================================================== */
/* =                           CREATE BOOKING                          = */
/* ==================================================================== */
export const createBooking = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res
        .status(401)
        .json({ message: "You must be logged in to create a booking." });
    }

    const userId = req.user.id;

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

    const bookingDoc = new Booking({
      type,
      itemId,
      guestInfo,
      guestCount,
      totalPrice,
      status: "Confirmed",
      checkInDate,
      checkOutDate,
      date,
      time,
      sessionId,
      user: userId,
    });

    await bookingDoc.save();
    console.log("✅ Booking created:", bookingDoc.bookingNumber);

    /* UPDATE CAPACITY — ROOMS: לא נוגעים ב-stock! */
    try {
      if (type === "workshop" && sessionId) {
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

        if (updateResult && updateResult.bookedCount >= updateResult.capacity) {
          await Session.findByIdAndUpdate(sessionId, { status: "full" });
        }
      } else if (type === "retreat") {
        await Retreat.findByIdAndUpdate(itemId, {
          $inc: { capacity: -guestCount },
        });
      }
      // type === "room" → לא עושים כלום ל־Room.stock
    } catch (err) {
      console.warn("⚠️ Capacity update failed:", err.message);
      await Booking.deleteOne({ _id: bookingDoc._id });
      return res.status(400).json({
        message: err.message || "Failed to reserve seats.",
      });
    }

    /* SEND EMAIL (Background) */
    try {
      console.log("📧 Sending confirmation to:", guestInfo.email);

      const htmlEmail = `
        <div style="font-family: Arial; background-color: #f6f9f8; padding: 40px;">
          <table width="100%" style="max-width:600px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background:#22615C;color:#fff;text-align:center;padding:20px;">
                <h2>Ban Tao Resort</h2>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;color:#333;">
                <h3>Thank you, ${guestInfo.fullName} 🌴</h3>
                <p>Your booking <b>#${
                  bookingDoc.bookingNumber
                }</b> is confirmed.</p>
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
              </td>
            </tr>
          </table>
        </div>`;

      res.status(201).json({
        message: "Booking created successfully",
        booking: bookingDoc,
      });

      setImmediate(async () => {
        try {
          if (process.env.RESEND_API_KEY) {
            const resend = new Resend(process.env.RESEND_API_KEY);
            await resend.emails.send({
              from: "Ban Tao <no-reply@resend.dev>",
              to: guestInfo.email,
              subject: `🌴 Booking Confirmation (${bookingDoc.bookingNumber})`,
              html: htmlEmail,
            });
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
              subject: `🌴 Booking Confirmation (${bookingDoc.bookingNumber})`,
              html: htmlEmail,
            });
          }
        } catch (err) {
          console.error("❌ Email send error (background):", err.message);
        }
      });

      return;
    } catch (err) {
      console.error("❌ Email send error:", err.message);
    }

    return res.status(201).json({
      message: "Booking created successfully",
      booking: bookingDoc,
    });
  } catch (err) {
    console.error("Error creating booking:", err);
    return res.status(500).json({
      message: "Server error during booking.",
    });
  }
};

/* ==================================================================== */
/* =                         USER / ADMIN LISTINGS                     = */
/* ==================================================================== */

/* ---------- 1) BOOKINGS OF LOGGED-IN USER ---------- */
export const getUsersBookings = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        message: "You must be logged in to view your bookings.",
      });
    }

    const bookings = await Booking.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .populate("itemId")
      .populate("sessionId")
      .populate("user", "name email role");

    return res.status(200).json({
      results: bookings.length,
      bookings,
    });
  } catch (err) {
    console.error("❌ getUsersBookings error:", err);
    return res.status(500).json({ message: "Server error loading bookings." });
  }
};

/* ---------- 2) ADMIN — GET ALL BOOKINGS ---------- */
export const getAllBookings = async (req, res) => {
  try {
    const bookings = await Booking.find()
      .sort({ createdAt: -1 })
      .populate("user", "name email role")
      .populate("itemId")
      .populate("sessionId");

    return res.status(200).json({
      results: bookings.length,
      bookings,
    });
  } catch (err) {
    console.error("❌ getAllBookings error:", err);
    return res.status(500).json({
      message: "Server error loading bookings.",
    });
  }
};

/* ---------- 3) UPDATE BOOKING (ADMIN) ---------- */
export const updateBooking = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findById(id);
    if (!booking)
      return res.status(404).json({ message: "Booking not found." });

    const allowed = [
      "status",
      "checkInDate",
      "checkOutDate",
      "date",
      "time",
      "guestCount",
      "totalPrice",
      "payment",
    ];

    allowed.forEach((field) => {
      if (req.body[field] !== undefined) {
        booking[field] = req.body[field];
      }
    });

    await booking.save();

    return res.status(200).json({
      message: "Booking updated successfully",
      booking,
    });
  } catch (err) {
    console.error("❌ updateBooking error:", err);
    return res.status(500).json({
      message: "Server error during booking update.",
    });
  }
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
      return res.status(200).json({
        message: "Booking already cancelled.",
      });

    try {
      // ROOMS: לא משחזרים stock – זמינות מחושבת דרך Booking בלבד.
      if (booking.type === "workshop" && booking.sessionId) {
        const s = await Session.findByIdAndUpdate(
          booking.sessionId,
          { $inc: { bookedCount: -booking.guestCount } },
          { new: true }
        );

        if (s && s.status === "full" && s.bookedCount < s.capacity) {
          await Session.findByIdAndUpdate(booking.sessionId, {
            status: "scheduled",
          });
        }
      } else if (booking.type === "retreat") {
        await Retreat.findByIdAndUpdate(booking.itemId, {
          $inc: { capacity: booking.guestCount },
        });
      }
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
      }
    } catch (err) {
      console.warn("⚠️ Email cancel send error:", err.message);
    }

    return res.status(200).json({
      message: "Booking cancelled successfully",
      booking,
    });
  } catch (err) {
    console.error("❌ Error cancelling booking:", err);
    return res.status(500).json({
      message: "Server error during cancellation.",
    });
  }
};
