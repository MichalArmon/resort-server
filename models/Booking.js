// 📁 models/Booking.js
import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    // סוג ההזמנה: room / treatment / workshop / retreat
    type: {
      type: String,
      required: true,
      enum: ["room", "treatment", "workshop", "retreat"],
      default: "room",
    },

    // מזהה האובייקט הרלוונטי (Room / Retreat / Treatment / Workshop)
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
      refPath: "typeRef", // נקבע לפי type
    },

    // דינמי: אם זה room -> ref הוא "Room", אם retreat -> "Retreat" וכו'
    typeRef: {
      type: String,
      required: false,
      enum: ["Room", "Retreat", "Treatment", "Workshop"],
    },

    // 🔹 לסדנאות: מזהה הסשן הספציפי (שיעור יחיד)
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: function () {
        return this.type === "workshop";
      },
    },

    // מס' הזמנה ייחודי
    bookingNumber: {
      type: String,
      unique: true,
      required: true,
      trim: true,
    },

    // תאריכים כלליים (רלוונטיים גם לחדרים וגם לסדנאות/טיפולים)
    date: Date, // לאירוע נקודתי (טיפול/סדנה/ריטריט)
    checkInDate: Date, // לחדרים
    checkOutDate: Date, // לחדרים
    time: String,

    // פרטים על הלקוח
    guestInfo: {
      fullName: { type: String, required: true },
      email: { type: String, required: true },
      phone: String,
      notes: String,
    },

    // נתונים כלליים
    guestCount: { type: Number, default: 1 },
    totalPrice: Number,
    discount: { type: Number, default: 0 }, // הנחות לאורחים בהמשך

    // סטטוס
    status: {
      type: String,
      enum: ["Pending", "Confirmed", "Canceled"],
      default: "Pending",
    },
  },
  { timestamps: true }
);

/* 🔧 אינדקסים שימושיים לביצועים */
bookingSchema.index({ type: 1, itemId: 1, sessionId: 1, status: 1 });
bookingSchema.index({ type: 1, itemId: 1, checkInDate: 1, checkOutDate: 1 }); // לחדרים
bookingSchema.index({ "guestInfo.email": 1, createdAt: -1 }); // לשליפת ההזמנות של משתמש

export default mongoose.model("Booking", bookingSchema);
