// 📁 models/Booking.js
import mongoose from "mongoose";

const { Schema, Types } = mongoose;

/** מיפוי בין type לשם המודל בפועל (ל-refPath) */
const TYPE_TO_MODEL = {
  room: "Room",
  treatment: "Treatment",
  workshop: "Workshop",
  retreat: "Retreat",
};

const PriceBreakdownSchema = new Schema(
  {
    base: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    fees: { type: Number, default: 0 },
  },
  { _id: false }
);

const PaymentSchema = new Schema(
  {
    method: {
      type: String,
      enum: ["cash", "card", "transfer", "none"],
      default: "none",
    },
    status: {
      type: String,
      enum: ["unpaid", "paid", "refunded"],
      default: "unpaid",
    },
    transactionId: String,
    notes: String,
  },
  { _id: false }
);

const BookingSchema = new Schema(
  {
    /** סוג ההזמנה */
    type: {
      type: String,
      required: true,
      enum: ["room", "treatment", "workshop", "retreat"],
      default: "room",
    },

    /** אובייקט שונה לפי type (Room / Treatment / Workshop / Retreat) */
    itemId: {
      type: Types.ObjectId,
      refPath: "typeRef",
      required: true,
    },

    /** נקבע אוטומטית לפני ולידציה לפי type */
    typeRef: {
      type: String,
      enum: Object.values(TYPE_TO_MODEL),
      required: true,
    },

    /** לסדנאות: סשן ספציפי בלו״ז */
    sessionId: {
      type: Types.ObjectId,
      ref: "Session",
      required: function () {
        return this.type === "workshop";
      },
    },

    /** מספר הזמנה ידידותי וייחודי */
    bookingNumber: {
      type: String,
      // ⚠️ הורדנו unique: true כדי לא להכפיל אינדקס
      required: true,
      trim: true,
    },

    /** תאריכים/שעות */
    date: Date, // טיפול/סדנה/ריטריט (אירוע נקודתי)
    checkInDate: Date, // חדרים
    checkOutDate: Date, // חדרים
    time: String, // אופציונלי לטיפולים

    /** פרטי לקוח */
    guestInfo: {
      fullName: { type: String, required: true },
      email: { type: String, required: true },
      phone: String,
      notes: String,
    },

    /** מספר משתתפים ומחירים */
    guestCount: { type: Number, default: 1, min: 1 },
    currency: { type: String, default: "ILS" },
    totalPrice: { type: Number, default: 0 },
    breakdown: { type: PriceBreakdownSchema, default: () => ({}) },

    /** סטטוס הזמנה ותשלום */
    status: {
      type: String,
      enum: ["Pending", "Confirmed", "Cancelled"],
      default: "Pending",
    },
    payment: { type: PaymentSchema, default: () => ({}) },
  },
  { timestamps: true }
);

/* אינדקסים שימושיים */
// נשאיר הגדרה אחת ייחודית ומרוכזת כאן:
BookingSchema.index(
  { bookingNumber: 1 },
  { unique: true, name: "uniq_bookingNumber" }
);
BookingSchema.index(
  { type: 1, itemId: 1, sessionId: 1, status: 1 },
  { name: "by_type_item_session_status" }
);
BookingSchema.index(
  { type: 1, itemId: 1, checkInDate: 1, checkOutDate: 1 },
  { name: "by_room_dates" }
);
BookingSchema.index(
  { "guestInfo.email": 1, createdAt: -1 },
  { name: "by_guest_email_created" }
);

/* ===== Hooks & Validation ===== */

/** קובע אוטומטית את typeRef לפי type */
BookingSchema.pre("validate", function (next) {
  if (!this.typeRef && this.type) {
    this.typeRef = TYPE_TO_MODEL[this.type];
  }
  next();
});

/** בודק שדות חובה בהתאם לסוג ההזמנה */
BookingSchema.pre("validate", function (next) {
  if (this.type === "room") {
    if (!this.checkInDate || !this.checkOutDate) {
      return next(
        new Error("checkInDate and checkOutDate are required for room bookings")
      );
    }
  } else {
    if (this.type === "workshop") {
      if (!this.sessionId) {
        return next(new Error("sessionId is required for workshop bookings"));
      }
    } else {
      if (!this.date) {
        return next(new Error("date is required for non-room bookings"));
      }
    }
  }
  next();
});

/** ייצור bookingNumber אוטומטית אם לא סופק */
BookingSchema.pre("validate", async function (next) {
  if (this.bookingNumber) return next();

  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  const prefix = `BK-${y}${m}${d}`;

  // נסיון לייצר רצף עד שמוצאים ייחודי
  for (let i = 0; i < 5; i++) {
    const rnd = Math.random().toString(36).slice(2, 7).toUpperCase();
    const candidate = `${prefix}-${rnd}`;
    const exists = await mongoose.models.Booking.exists({
      bookingNumber: candidate,
    });
    if (!exists) {
      this.bookingNumber = candidate;
      return next();
    }
  }
  next(new Error("Failed to generate unique bookingNumber"));
});

export default mongoose.model("Booking", BookingSchema);
