import User from "../models/User.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

/* ============================================================
   🧩 Helpers
   ============================================================ */
const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

/* ============================================================
   👤 Register (Signup)
   ============================================================ */
export const registerUser = async (req, res) => {
  try {
    const { email, password, fullName } = req.body;

    if (!email) return res.status(400).json({ message: "Email is required." });

    // בדוק אם כבר קיים משתמש עם אותו אימייל
    const existing = await User.findOne({ email });
    if (existing)
      return res.status(409).json({ message: "User already exists." });

    const user = await User.create({
      email,
      password,
      loginType: "local",
      role: "user",
    });

    const token = signToken(user);
    res.status(201).json({ user, token });
  } catch (err) {
    console.error("❌ registerUser failed:", err);
    res.status(500).json({ message: "Registration failed." });
  }
};

/* ============================================================
   🔑 Login
   ============================================================ */
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select("+password");

    if (!user)
      return res.status(401).json({ message: "Invalid email or password." });

    if (user.loginType === "google")
      return res
        .status(400)
        .json({ message: "This account uses Google sign-in." });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ message: "Invalid email or password." });

    const token = signToken(user);
    res.status(200).json({ user, token });
  } catch (err) {
    console.error("❌ loginUser failed:", err);
    res.status(500).json({ message: "Login failed." });
  }
};

/* ============================================================
   🧭 Get all users (Admin)
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
   👁️ Get user by ID
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
   🧱 Delete user
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
