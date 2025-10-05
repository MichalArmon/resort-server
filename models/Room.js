// models/Room.js

import mongoose from "mongoose";

const roomSchema = new mongoose.Schema({
  roomName: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  roomType: {
    type: String,
    required: true,
    enum: ["Deluxe Villa", "Standard Bungalow", "Family Suite"],
    default: "Standard Bungalow",
  },
  capacity: {
    type: Number,
    required: true,
    default: 2,
  },
  basePrice: {
    type: Number,
    required: true,
  }, // מחיר בסיס ללילה (במטבע שבחרת)
  amenities: [
    {
      type: String,
    },
  ],
  // 🔑 שדה חדש לתמונת החדר
  imageURL: {
    type: String, // כתובת URL לתמונה
    default:
      "https://static.asianpaints.com/content/dam/asianpaintsbeautifulhomes/202303/scandinavian-bedroom-design/title-wooden-tone-scandinavian-bedroom-designs.jpg.transform/bh-tb-image-container/image.webp", // ניתן להשאיר ריק או לשים URL לתמונה כללית
  },
});

const Room = mongoose.model("Room", roomSchema);
export default Room;
