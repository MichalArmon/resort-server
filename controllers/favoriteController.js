// 📁 controllers/favoriteController.js
import Room from "../models/Room.js";
import Retreat from "../models/Retreat.js";
import Treatment from "../models/Treatment.js";
import Workshop from "../models/Workshop.js";

const MODELS = {
  room: Room,
  retreat: Retreat,
  treatment: Treatment,
  workshop: Workshop,
};

/* ============================================================
   1) GET USER FAVORITES (IDs בלבד)
   ============================================================ */
export const getUserFavorites = async (req, res) => {
  try {
    const userId = req.params.userId;

    if (!userId)
      return res.status(400).json({ message: "User ID is required." });

    const [rooms, retreats, treatments, workshops] = await Promise.all([
      Room.find({ likedBy: userId }).select("_id slug likesCount"),
      Retreat.find({ likedBy: userId }).select("_id slug likesCount"),
      Treatment.find({ likedBy: userId }).select("_id slug likesCount"),
      Workshop.find({ likedBy: userId }).select("_id slug likesCount"),
    ]);

    res.status(200).json({
      rooms,
      retreats,
      treatments,
      workshops,
    });
  } catch (err) {
    console.error("❌ getUserFavorites:", err);
    res.status(500).json({ message: "Failed to fetch favorites." });
  }
};

/* ============================================================
   2) GET FAVORITES — FULL DETAILS
   ============================================================ */
export const getUserFavoritesFull = async (req, res) => {
  try {
    const userId = req.params.userId;

    if (!userId)
      return res.status(400).json({ message: "User ID is required." });

    const [rooms, retreats, treatments, workshops] = await Promise.all([
      Room.find({ likedBy: userId }),
      Retreat.find({ likedBy: userId }),
      Treatment.find({ likedBy: userId }),
      Workshop.find({ likedBy: userId }),
    ]);

    res.status(200).json({
      rooms,
      retreats,
      treatments,
      workshops,
    });
  } catch (err) {
    console.error("❌ getUserFavoritesFull:", err);
    res.status(500).json({ message: "Failed to fetch full favorites." });
  }
};

/* ============================================================
   3) TOGGLE FAVORITE — JWT VERSION
   ============================================================ */
export const toggleFavorite = async (req, res) => {
  try {
    // 🟣 משתמש מחובר בלבד! (מ־protect)
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        message: "You must be logged in to favorite items.",
      });
    }

    const userId = req.user.id;
    const { itemId, itemType } = req.body;

    if (!itemId || !itemType) {
      return res.status(400).json({
        message: "Missing fields: itemId, itemType.",
      });
    }

    const Model = MODELS[itemType];
    if (!Model) {
      return res.status(400).json({ message: "Invalid itemType." });
    }

    const item = await Model.findById(itemId);
    if (!item) {
      return res.status(404).json({ message: "Item not found." });
    }

    const alreadyLiked = item.likedBy.some((u) => String(u) === String(userId));

    if (alreadyLiked) {
      // ❌ הסרה
      item.likedBy = item.likedBy.filter((u) => String(u) !== String(userId));
      item.likesCount = Math.max(0, item.likesCount - 1);
      await item.save();

      return res.status(200).json({
        liked: false,
        likesCount: item.likesCount,
      });
    }

    // ❤️ הוספה
    item.likedBy.push(userId);
    item.likesCount += 1;
    await item.save();

    return res.status(201).json({
      liked: true,
      likesCount: item.likesCount,
    });
  } catch (err) {
    console.error("❌ toggleFavorite:", err);
    res.status(500).json({ message: "Failed to toggle favorite." });
  }
};
