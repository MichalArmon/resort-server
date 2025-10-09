// controllers/booking.controller.js (רק הפונקציה checkAvailability)
import Booking from "../models/Booking.js";
import Room from "../models/Room.js";
import Retreat from "../models/Retreat.js";

export const checkAvailability = async (req, res) => {
  const { checkIn, checkOut, guests, rooms } = req.query;
  if (!checkIn || !checkOut || !guests || !rooms) {
    return res.status(400).json({
      message: "Check-in, Check-out, guests, and rooms are required.",
    });
  }

  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  const requiredGuests = parseInt(guests, 10);
  const requiredRooms = parseInt(rooms, 10);
  const minCapacityPerRoom = Math.ceil(requiredGuests / requiredRooms);

  try {
    // 0) ריטריט שסוגר את האתר
    const closedRetreat = await Retreat.findOne({
      isClosed: true,
      startDate: { $lt: checkOutDate },
      endDate: { $gt: checkInDate },
    });
    if (closedRetreat) {
      return res.status(200).json({
        availableRooms: [],
        summary: {},
        message: `The resort is closed for ${closedRetreat.name} in these dates.`,
      });
    }

    // 1) כל החדרים שעומדים בדרישת קיבולת (מועמדים)
    //    אם roomType הוא ref למודל RoomType -> נעשה populate להביא slug/title
    const candidateRooms = await Room.find({
      capacity: { $gte: minCapacityPerRoom },
    })
      .select("_id roomType capacity basePrice")
      .populate({ path: "roomType", select: "slug title" }); // מחקי שורה זו אם roomType הוא string

    // 2) חישוב stock כולל לפי סוג (מתוך כל החדרים המתאימים)
    //    key יהיה slug (אם יש populate) או room.roomType כנ"ל
    const totalByType = {};
    for (const r of candidateRooms) {
      const key = r.roomType?.slug || r.roomType; // תמיכה גם ב-ref וגם במחרוזת
      totalByType[key] = totalByType[key] || { totalStock: 0 };
      totalByType[key].totalStock += 1;
      // נשמור גם title לנוחות בפרונט
      if (r.roomType?.title) totalByType[key].title = r.roomType.title;
    }

    // 3) כל החדרים שהתפוסים בטווח (Confirmed; אפשר לשקול לכלול גם Pending למניעת דאבל־בוקינג)
    const occupiedBookings = await Booking.find({
      status: "Confirmed", // שקלי להרחיב ל: { $in: ["Confirmed","Pending"] }
      $and: [
        { checkInDate: { $lt: checkOutDate } },
        { checkOutDate: { $gt: checkInDate } },
      ],
    }).select("bookedRoom");

    const occupiedIds = new Set(
      occupiedBookings.map((b) => String(b.bookedRoom))
    );

    // 4) סינון רשימת החדרים הפנויים בפועל
    const availableRooms = candidateRooms.filter(
      (r) => !occupiedIds.has(String(r._id))
    );

    // 5) זמינות לפי סוג: available / occupied
    const summary = {};
    for (const r of candidateRooms) {
      const key = r.roomType?.slug || r.roomType;
      if (!summary[key]) {
        const base = totalByType[key] || { totalStock: 0 };
        summary[key] = {
          title: base.title || (r.roomType?.title ?? key),
          totalStock: base.totalStock,
          availableUnits: 0,
          occupiedUnits: 0,
        };
      }
    }
    for (const r of candidateRooms) {
      const key = r.roomType?.slug || r.roomType;
      if (occupiedIds.has(String(r._id))) {
        summary[key].occupiedUnits += 1;
      } else {
        summary[key].availableUnits += 1;
      }
    }

    // 6) האם יש מספיק יחידות ביחד לעוד הזמנה של requiredRooms?
    const totalAvailableUnits = Object.values(summary).reduce(
      (acc, s) => acc + (s.availableUnits || 0),
      0
    );

    if (totalAvailableUnits < requiredRooms) {
      return res.status(200).json({
        checkIn: checkInDate,
        checkOut: checkOutDate,
        availableRooms: [],
        summary,
        message: `Only ${totalAvailableUnits} units available; you requested ${requiredRooms}.`,
      });
    }

    // אופציונלי: לסנן ולהחזיר רק N חדרים לפי הדרישה
    // כרגע מחזירים את כל החדרים הפנויים + תקציר summary
    return res.status(200).json({
      checkIn: checkInDate,
      checkOut: checkOutDate,
      availableRooms, // רשימת חדרים ספציפיים
      summary, // סיכום לפי סוג חדר: totalStock/available/occupied
      message: `Found ${totalAvailableUnits} units available.`,
    });
  } catch (error) {
    console.error("Error fetching availability:", error);
    return res
      .status(500)
      .json({ message: "Server error during availability check." });
  }
};
