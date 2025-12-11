import User from "../models/User.js";
import Booking from "../models/Booking.js";

/* ============================================================
   🧭 GET ALL USERS (ADMIN)
============================================================ */
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.status(200).json(users);
  } catch (err) {
    console.error("❌ getAllUsers failed:", err);
    res.status(500).json({ message: "Failed to fetch users." });
  }
};

/* ============================================================
   👁️ GET USER BY ID (ADMIN)
============================================================ */
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found." });

    res.status(200).json(user);
  } catch (err) {
    console.error("❌ getUserById failed:", err);
    res.status(500).json({ message: "Failed to fetch user." });
  }
};

/* ============================================================
   🧱 DELETE USER (ADMIN)
============================================================ */
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByIdAndDelete(id);
    if (!user) return res.status(404).json({ message: "User not found." });

    res.status(200).json({ message: "User deleted." });
  } catch (err) {
    console.error("❌ deleteUser failed:", err);
    res.status(500).json({ message: "Failed to delete user." });
  }
};

/* ============================================================
   🟢 CHECK-IN (ADMIN)
============================================================ */
export const checkInUser = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId).populate("user");
    if (!booking)
      return res.status(404).json({ message: "Booking not found." });

    booking.status = "checked-in";
    await booking.save();

    booking.user.inhouseStatus = true;
    booking.user.currentBooking = booking._id;
    await booking.user.save();

    res.status(200).json({
      message: "User is now INHOUSE.",
      user: booking.user,
    });
  } catch (err) {
    console.error("❌ checkInUser failed:", err);
    res.status(500).json({ message: "Check-in failed." });
  }
};

/* ============================================================
   🔵 CHECK-OUT (ADMIN)
============================================================ */
export const checkOutUser = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId).populate("user");
    if (!booking)
      return res.status(404).json({ message: "Booking not found." });

    booking.status = "checked-out";
    await booking.save();

    booking.user.inhouseStatus = false;
    booking.user.currentBooking = null;
    await booking.user.save();

    res.status(200).json({
      message: "User checked-out successfully.",
      user: booking.user,
    });
  } catch (err) {
    console.error("❌ checkOutUser failed:", err);
    res.status(500).json({ message: "Check-out failed." });
  }
};

/* ============================================================
   🔮 UPDATE ASTRO PROFILE (USER)
============================================================ */
export const updateAstroProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const { birthDate, birthTime, lat, lon, tzone, birthPlace } = req.body;

    user.birthDate = birthDate;
    user.birthTime = birthTime;
    user.birthLat = lat;
    user.birthLon = lon;
    user.birthTzOffset = tzone;
    user.birthPlace = birthPlace;

    await user.save();

    res.status(200).json({
      message: "Astro profile updated successfully",
      user,
    });
  } catch (err) {
    console.error("❌ updateAstroProfile error:", err);
    res.status(500).json({
      message: "Failed to update astro profile",
    });
  }
};
