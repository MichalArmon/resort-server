// controllers/authController.js

import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Booking from "../models/Booking.js";
import { OAuth2Client } from "google-auth-library";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/* ----------------------------------------------------
   Helper: Sign JWT with id + role
---------------------------------------------------- */
const signToken = (user) => {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

/* ----------------------------------------------------
   SIGNUP
---------------------------------------------------- */
export const signup = async (req, res) => {
  try {
    const newUser = await User.create({
      email: req.body.email,
      password: req.body.password,
      name: {
        first: req.body.name?.first || "",
        last: req.body.name?.last || "",
      },
      phone: req.body.phone || "",
      country: req.body.address?.country || "",
      city: req.body.address?.city || "",
      birthDate: req.body.birthDate || null,
      role: "user",
      loginType: "local",
    });

    const token = signToken(newUser);

    res.status(201).json({
      status: "success",
      token,
      data: {
        user: {
          id: newUser._id,
          email: newUser.email,
          role: newUser.role,
          name: newUser.name,
          birthDate: newUser.birthDate,
        },
      },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({
        status: "fail",
        message: "Email address already in use.",
      });
    }

    res.status(400).json({
      status: "fail",
      message: err.message,
    });
  }
};

/* ----------------------------------------------------
   LOGIN
---------------------------------------------------- */
export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({
      status: "fail",
      message: "Please provide email and password.",
    });

  const user = await User.findOne({ email }).select("+password");

  if (!user || !(await user.correctPassword(password, user.password))) {
    return res.status(401).json({
      status: "fail",
      message: "Incorrect email or password.",
    });
  }

  const token = signToken(user);
  user.password = undefined;

  res.status(200).json({
    status: "success",
    token,
    data: {
      user: {
        id: user._id,
        role: user.role,
        email: user.email,
        firstName: user.firstName || "",
        lastName: user.lastName || "",
      },
    },
  });
};

/* ----------------------------------------------------
   GOOGLE AUTH
---------------------------------------------------- */
export const googleAuth = async (req, res) => {
  const { idToken } = req.body;

  if (!idToken) {
    return res.status(400).json({
      status: "fail",
      message: "ID Token is missing.",
    });
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const email = payload.email;

    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        email,
        firstName: payload.given_name || "",
        lastName: payload.family_name || "",
        loginType: "google",
        role: "user",
      });
    }

    const token = signToken(user);

    res.status(200).json({
      status: "success",
      token,
      data: {
        user: {
          id: user._id,
          role: user.role,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      },
    });
  } catch (error) {
    res.status(401).json({
      status: "fail",
      message: "Invalid Google ID Token.",
    });
  }
};

/* ----------------------------------------------------
   GUEST LOGIN
---------------------------------------------------- */
export const guestLogin = async (req, res) => {
  const { bookingNumber, email } = req.body;

  if (!bookingNumber || !email) {
    return res.status(400).json({
      status: "fail",
      message: "Please provide booking number and email.",
    });
  }

  const booking = await Booking.findOne({
    bookingNumber,
    "guestInfo.email": email,
    status: "Confirmed",
    checkOutDate: { $gte: new Date() },
  });

  if (!booking) {
    return res.status(401).json({
      status: "fail",
      message: "Invalid booking details.",
    });
  }

  let user = await User.findOne({ email });

  if (!user) {
    user = await User.create({
      email,
      loginType: "local",
      role: "guest",
      firstName: booking.guestInfo.fullName || "",
    });
  }

  const token = signToken(user);

  res.status(200).json({
    status: "success",
    token,
    data: {
      user: {
        id: user._id,
        role: user.role,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    },
  });
};

/* ----------------------------------------------------
   PROTECT (JWT Middleware)
---------------------------------------------------- */
export const protect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        message: "You are not logged in. Please log in first.",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        message: "User belonging to this token no longer exists.",
      });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("❌ protect error:", err);
    return res.status(401).json({
      message: "Invalid or expired token.",
    });
  }
};

/* ----------------------------------------------------
   RESTRICT TO
---------------------------------------------------- */
export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "You do not have permission to perform this action.",
      });
    }
    next();
  };
};
