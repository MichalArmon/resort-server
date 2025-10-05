import Booking from "../models/Booking.js";
import Room from "../models/Room.js";
import PricingRule from "../models/PricingRule.js";
import Retreat from "../models/Retreat.js"; // ייבוא מודל Retreat

// פונקציה לבדיקת זמינות (מעודכן: כולל בדיקת ריטריט)
export const checkAvailability = async (req, res) => {
  // 1. קבלת פרמטרים ואימותם
  const { checkIn, checkOut, guests, rooms } = req.query;

  if (!checkIn || !checkOut || !guests || !rooms) {
    return res.status(400).json({
      message: "Check-in, Check-out, guests, and rooms are required.",
    });
  }

  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  const requiredGuests = parseInt(guests);
  const requiredRooms = parseInt(rooms);

  try {
    // 1. בדיקת ריטריט פעיל שחוסם הזמנות
    const closedRetreat = await Retreat.findOne({
      isClosed: true,
      startDate: { $lt: checkOutDate },
      endDate: { $gt: checkInDate },
    });

    if (closedRetreat) {
      return res.status(200).json({
        availableRooms: [], // מערך ריק
        summary: {},
        message: `The resort is currently closed for the private event (${closedRetreat.name}) between these dates.`,
      });
    }

    // 2. מציאת כל מזהי החדרים התפוסים
    const occupiedBookings = await Booking.find({
      status: "Confirmed",
      // תנאי חפיפה
      $and: [
        { checkInDate: { $lt: checkOutDate } },
        { checkOutDate: { $gt: checkInDate } },
      ],
    }).select("bookedRoom");

    const occupiedRoomIds = occupiedBookings.map(
      (booking) => booking.bookedRoom
    );

    // 3. מציאת החדרים הפנויים שגם עומדים בדרישות הקיבולת
    const availableRooms = await Room.find({
      _id: { $nin: occupiedRoomIds }, // חדרים שאינם תפוסים
      // קיבולת החדר צריכה להיות גדולה או שווה לממוצע אורחים לחדר
      capacity: { $gte: Math.ceil(requiredGuests / requiredRooms) },
    });

    // 4. קיבוץ החדרים לפי סוג ובדיקת מלאי
    const availabilityByRoomType = availableRooms.reduce((acc, room) => {
      acc[room.roomType] = (acc[room.roomType] || 0) + 1;
      return acc;
    }, {});

    const totalAvailableRooms = availableRooms.length;

    if (totalAvailableRooms < requiredRooms) {
      return res.status(200).json({
        availableRooms: [],
        summary: {},
        message: `Found ${totalAvailableRooms} available rooms, but you require ${requiredRooms} rooms.`,
      });
    }

    // 5. החזרת התוצאות
    res.status(200).json({
      checkIn: checkInDate,
      checkOut: checkOutDate,
      availableRooms: availableRooms,
      summary: availabilityByRoomType,
      message: `Found ${totalAvailableRooms} rooms matching your request.`,
    });
  } catch (error) {
    console.error("Error fetching availability:", error);
    res
      .status(500)
      .json({ message: "Server error during availability check." });
  }
};

// פונקציה לחישוב הצעת מחיר
export const getQuote = async (req, res) => {
  const { checkIn, checkOut, roomType } = req.body;

  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);

  // 💡 0. בדיקת חפיפה עם ריטריט פעיל
  const activeRetreat = await Retreat.findOne({
    // בודקים אם יש ריטריט שחופף לתקופה
    startDate: { $lt: checkOutDate },
    endDate: { $gt: checkInDate },
  });

  if (activeRetreat) {
    // אם נמצא ריטריט פעיל, מחזירים את המחיר הקבוע שלו (כולל מע"מ/מסים)

    // מניחים שהמחיר הקבוע כולל כבר את כל המרכיבים (חדר, שירותים, מסים)
    const finalPrice = activeRetreat.price;

    return res.status(200).json({
      totalPrice: finalPrice,
      isRetreatPrice: true, // דגל שמציין שמחיר זה הוא מחיר ריטריט קבוע
      retreatName: activeRetreat.name,
      currency: "ILS",
      message: `Quote based on fixed price for ${activeRetreat.name}.`,
    });
  }

  // --- אם לא נמצא ריטריט פעיל, ממשיכים בלוגיקת תמחור רגילה ---

  // 1. נחשב את מספר הלילות
  const nights = Math.ceil(
    (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 3600 * 24)
  );

  if (nights <= 0) {
    return res
      .status(400)
      .json({ message: "Check-out must be after check-in." });
  }

  // 2. נמצא את מחיר הבסיס
  const baseRoom = await Room.findOne({ roomType: roomType }).sort({
    basePrice: 1,
  });
  if (!baseRoom) {
    return res.status(404).json({ message: "Room type not found." });
  }

  let total = baseRoom.basePrice * nights; // מחיר בסיס ראשוני

  // 3. יישום כללי תמחור (Pricing Rules)
  const rules = await PricingRule.find({
    startDate: { $lte: checkOutDate },
    endDate: { $gte: checkInDate },
    $or: [{ appliesTo: "ALL" }, { appliesTo: roomType }],
  });

  if (rules.length > 0) {
    const highestMultiplier = rules.reduce(
      (max, rule) => Math.max(max, rule.priceMultiplier),
      1.0
    );
    total = total * highestMultiplier;
  }

  const finalPrice = Math.round(total * 1.07); // הוספת 7% מע"מ/מסים

  res.status(200).json({
    totalPrice: finalPrice,
    nights: nights,
    isRetreatPrice: false,
    currency: "ILS",
  });
};

// פונקציה ליצירת הזמנה (סטטוס Pending)
export const createBooking = async (req, res) => {
  const { checkIn, checkOut, roomTypeId, guestInfo, totalPrice, guestCount } =
    req.body;

  // 💡 ודא שהחדר עדיין פנוי לפני שממשיכים
  // לוגיקה זו תהיה מורכבת: עדיף לבצע Transaction אם אפשר, אך כרגע נסתפק בבדיקה רגילה.

  // 1. יצירת ההזמנה
  const newBooking = new Booking({
    bookedRoom: roomTypeId, // מזהה החדר הספציפי שנבחר
    checkInDate: new Date(checkIn),
    checkOutDate: new Date(checkOut),
    guestCount: guestCount,
    totalPrice: totalPrice,
    status: "Pending", // ממתין לתשלום
    guestInfo: guestInfo,
  });

  try {
    const savedBooking = await newBooking.save();
    res.status(201).json({
      message: "Booking successfully created. Proceed to payment.",
      bookingId: savedBooking._id,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error creating booking.", error: error.message });
  }
};

// ----------------------------------------------------
// פונקציות הדורשות אימות והרשאה (Authorization)
// ----------------------------------------------------

// 1. צפייה בהזמנות של המשתמש הנוכחי (משתמש רגיל/אורח)
// Route: /api/v1/bookings/my-bookings
export const getUsersBookings = async (req, res) => {
  try {
    // 💡 req.user נשלף על ידי ה-middleware 'protect'
    const bookings = await Booking.find({
      "guestInfo.email": req.user.email,
      // או, אם שמרתם ID במודל Booking: user: req.user._id
    }).sort({ createdAt: -1 }); // מציג את החדשות קודם

    res.status(200).json({
      status: "success",
      results: bookings.length,
      data: { bookings },
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching user bookings.", error: error.message });
  }
};

// 2. צפייה בכל ההזמנות (מוגבל ל-admin, employee)
// Route: /api/v1/bookings/all-bookings
export const getAllBookings = async (req, res) => {
  // 💡 הפונקציה restrictTo('admin', 'employee') כבר רצה, אז אין צורך בבדיקת תפקיד כאן!
  try {
    const bookings = await Booking.find().populate("bookedRoom"); // מציג גם את פרטי החדר

    res.status(200).json({
      status: "success",
      results: bookings.length,
      data: { bookings },
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching all bookings.", error: error.message });
  }
};

// 3. עדכון/ניהול הזמנה ספציפית (מוגבל ל-admin, employee)
// Route: PATCH /api/v1/bookings/:id
export const updateBooking = async (req, res) => {
  try {
    const booking = await Booking.findByIdAndUpdate(req.params.id, req.body, {
      new: true, // מחזיר את המסמך המעודכן
      runValidators: true,
    });

    if (!booking) {
      return res.status(404).json({ message: "Booking not found." });
    }

    res.status(200).json({
      status: "success",
      data: { booking },
    });
  } catch (error) {
    res
      .status(400)
      .json({ message: "Invalid update data.", error: error.message });
  }
};
