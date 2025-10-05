// models/Booking.js

import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    retreatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Retreat",
      required: false, // לא חובה, רוב ההזמנות הן רגילות
    },
    // קישור לחדר שנתפס (Refers to Room model)
    bookingNumber: {
      type: String,
      unique: true,
      required: true,
      trim: true,
    },
    bookedRoom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },
    checkInDate: {
      type: Date,
      required: true,
    },
    checkOutDate: {
      type: Date,
      required: true,
    },

    guestCount: {
      type: Number,
      required: true,
      default: 1,
    },
    totalPrice: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
      required: true,
      enum: ["Pending", "Confirmed", "Canceled"],
      default: "Pending",
    },

    guestInfo: {
      fullName: {
        type: String,
        required: true,
      },
      email: {
        type: String,
        required: true,
      },
      phone: {
        type: String,
      },
    },
  },
  { timestamps: true }
);

const Booking = mongoose.model("Booking", bookingSchema);
export default Booking;
