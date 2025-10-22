// 📘 controllers/scheduleController.js
// Unified Schedule Controller
// כולל:
//   - לוח אמיתי לאורחים (RRULE occurrences + Manual Grid)
//   - לוח ידני לאדמין (Grid CRUD מלא)
//   - ניהול Sessions (חישוב, יצירה, שליפה)

// ============================================================
// Imports
// ============================================================
import Schedule from "../models/Schedule.js";
import RecurringRule from "../models/RecurringRule.js";
import Session from "../models/Session.js";
import Workshop from "../models/Workshop.js";
import pkg from "rrule";
const { RRule } = pkg;

// ============================================================
// Constants
// ============================================================
const TZ = "Asia/Jerusalem"; // כבר מוגדר גם ב-server.js למניעת היסטים

// Map Grid day keys to JS Date.getDay() (0=Sun, 1=Mon... 6=Sat)
const DAY_MAP = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

// ============================================================
// Helpers
// ============================================================

/**
 * בונה אובייקט Date מקומי (ב-Asia/Jerusalem) מתוך תאריך (YYYY-MM-DD) ושעה (HH:MM).
 * @param {string} dateKey - תאריך בפורמט YYYY-MM-DD.
 * @param {string} timeKey - שעה בפורמט HH:MM (לדוגמה "09:00").
 * @returns {Date} אובייקט Date בזמן לוקאלי TZ.
 */
function buildLocalDateTime(dateKey, timeKey = "00:00") {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [h, min] = timeKey.split(":").map(Number);

  // יצירת תאריך שמייצג את התאריך והשעה הללו ב-UTC. זהו הבסיס לעבודה מדויקת.
  const utcDate = new Date(Date.UTC(y, m - 1, d, h, min));

  return utcDate;
}

/**
 * יוצר מזהה תאריך ושעה לוקאלי (Asia/Jerusalem) לשימוש כמפתח.
 * @param {Date} date - אובייקט Date.
 * @returns {{dateKey: string, hourKey: string}} מפתחות תאריך ושעה לוקאליים.
 */
function toLocalKeys(date) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).map((p) => [p.type, p.value])
  );
  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    // ניקח רק את השעה המלאה
    hourKey: `${String(parts.hour).padStart(2, "0")}:00`,
  };
}

// ============================================================
// NEW: מחשב Occurrences מתוך הלוח הידני (Grid)
// ============================================================

/**
 * מחשב Occurrences מתוך הלוח הידני (Grid).
 * @param {string} from - תאריך התחלה YYYY-MM-DD.
 * @param {string} to - תאריך סיום YYYY-MM-DD.
 * @param {string} weekKey - מפתח הלוח השבועי.
 * @returns {Promise<Array<object>>} רשימת הופעות מתוארכת.
 */
async function buildGridOccurrences(from, to, weekKey = "default") {
  const fromDate = buildLocalDateTime(from, "00:00");
  const toDate = buildLocalDateTime(to, "23:59");
  const rows = [];

  // 1. שליפת תבנית הגריד הידני
  const scheduleDoc = await Schedule.findOne({ weekKey });
  const grid = scheduleDoc?.grid || {};

  if (Object.keys(grid).length === 0) return rows;

  // 2. לולאה על כל יום בטווח התאריכים
  const today = new Date(fromDate);
  // ודא שהשעה היא 00:00:00:000 כדי למנוע טעויות חישוב יום
  today.setHours(0, 0, 0, 0);
  const oneDay = 24 * 60 * 60 * 1000;

  while (today <= toDate) {
    // בגלל השימוש ב-new Date() וב-TZ, getDay() מחזיר את יום השבוע המקומי (0=ראשון)
    const dayOfWeekLocal = today.getDay();

    // יצירת מפתח יום (למשל 'Mon') לפי המיפוי
    const dayKey = Object.keys(DAY_MAP).find(
      (key) => DAY_MAP[key] === dayOfWeekLocal
    );
    const { dateKey } = toLocalKeys(today); // מפתח התאריך הנדרש

    if (dayKey && grid[dayKey]) {
      const daySchedule = grid[dayKey];

      // עוברים על השעות (hourKey) והסטודיואים (studioName)
      for (const hourKey in daySchedule) {
        const studios = daySchedule[hourKey];

        for (const studioName in studios) {
          const workshopId = studios[studioName];
          if (!workshopId) continue;

          // שליפת פרטי הסדנה (כדי לקבל משך זמן וכותרת)
          const workshop = await Workshop.findById(workshopId).lean();

          // יצירת אובייקט Date ספציפי לסשן
          const startLocal = buildLocalDateTime(dateKey, hourKey);

          // חישוב זמן סיום (ברירת מחדל 60 דקות)
          const durationMin =
            workshop?.durationMin > 0 ? workshop.durationMin : 60;
          const endLocal = new Date(startLocal.getTime() + durationMin * 60000);

          rows.push({
            source: "manual", // מקור ידני
            date: dateKey,
            hour: hourKey,
            start: startLocal,
            end: endLocal,
            studio: studioName,
            workshopId: workshop?._id || workshopId,
            workshopSlug: workshop?.slug || null,
            workshopTitle: workshop?.title || `Manual Session - ${workshopId}`,
            ruleId: null,
          });
        }
      }
    }

    // מקדמים את התאריך ביום אחד
    today.setTime(today.getTime() + oneDay);
  }

  return rows;
}

// ============================================================
// REFACTORED: מחשב Occurrences מתוך RecurringRule (פונקציה ישנה, שונה שם)
// ============================================================

/**
 * מחשב Occurrences מתוך RecurringRule בלבד.
 */
async function buildRRuleOccurrences(from, to) {
  // ⬅️ שינוי שם מ-buildOccurrences
  // מכינים את טווחי החיפוש ב-Date objects
  const fromDate = buildLocalDateTime(from, "00:00");
  const toDate = buildLocalDateTime(to, "23:59");

  // מושכים את כל הכללים הפעילים
  const rules = await RecurringRule.find({ isActive: true }).populate(
    "workshopId"
  );
  const rows = [];

  for (const rule of rules) {
    let opts;
    try {
      // מנתחים את מחרוזת RRULE
      opts = RRule.parseString(rule.rrule);
    } catch (e) {
      console.warn(
        `⚠️ Skipping rule ${rule._id}: invalid RRule string. Error: ${e.message}`
      );
      continue; // כלל שבור – מתעלמים
    }

    // הגדרת dtstart
    let dtstart = new Date();
    if (rule.effectiveFrom) {
      const maybe = buildLocalDateTime(
        rule.effectiveFrom,
        rule.startTime || "00:00"
      );
      if (!isNaN(maybe.getTime())) dtstart = maybe;
    }

    // רק אם dtstart חוקי – נוסיף אותו ל-opts
    if (dtstart instanceof Date && !isNaN(dtstart.getTime())) {
      opts.dtstart = dtstart;
    } else {
      console.warn(
        `⚠️ Skipping rule ${rule._id}: invalid dtstart/effectiveFrom`
      );
      continue;
    }

    // הגדרת until (אם קיים effectiveTo)
    if (rule.effectiveTo) {
      const until = buildLocalDateTime(rule.effectiveTo, "23:59");
      until.setSeconds(59, 999); // כדי לכלול את כל היום
      opts.until = until;
    }

    // מוודאים ש-TZ מוגדר ב-opts
    opts.tzid = TZ;

    // יוצרים את אובייקט RRule ומחשבים את ההופעות
    let r;
    try {
      r = new RRule(opts);
    } catch (e) {
      console.warn(
        `⚠️ Skipping rule ${rule._id}: RRule construction error. Error: ${e.message}`
      );
      continue;
    }

    // true = include_start (כולל את dtstart במידה והוא בתוך הטווח)
    const occ = r.between(fromDate, toDate, true);

    // מכינים את סט התאריכים המוחרגים
    const excSet = new Set((rule.exceptions || []).map((d) => d));

    for (const startLocal of occ) {
      const { dateKey, hourKey } = toLocalKeys(startLocal);

      // בודקים אם התאריך מוחרג
      if (excSet.has(dateKey)) continue;

      // חישוב זמן סיום
      const durationMin = rule.durationMin > 0 ? rule.durationMin : 60;
      const endLocal = new Date(startLocal.getTime() + durationMin * 60000);

      // מוסיפים לשורות
      rows.push({
        source: "recurring", // מקור RRULE
        date: dateKey,
        hour: hourKey,
        start: startLocal,
        end: endLocal,
        studio: rule.studio || "Unassigned",
        workshopId: rule.workshopId?._id || null,
        workshopSlug: rule.workshopId?.slug || null,
        workshopTitle: rule.workshopId?.title || "(Untitled workshop)",
        ruleId: rule._id,
      });
    }
  }

  return rows;
}

// ============================================================
// NEW: הפונקציה המאוחדת שמחברת את הכל
// ============================================================

/**
 * מחשב את כל ההופעות (Occurrences) בטווח תאריכים: RRULE + Manual Grid.
 * @param {string} from - תאריך התחלה YYYY-MM-DD.
 * @param {string} to - תאריך סיום YYYY-MM-DD.
 * @returns {Promise<Array<object>>} רשימה מלאה וממוינת של סשנים מתוארכים.
 */
async function buildOccurrences(from, to) {
  // 1. מחשבים הופעות מ-RRULE
  const rruleOccurrences = await buildRRuleOccurrences(from, to);

  // 2. מחשבים הופעות מה-Grid הידני
  const gridOccurrences = await buildGridOccurrences(from, to);

  // 3. איחוד (כדי ליישם דריסה, נצטרך לוגיקה נוספת. כרגע מאחדים הכל).
  let allOccurrences = [...rruleOccurrences, ...gridOccurrences];

  // 4. מיון סופי לפי זמן התחלה וסטודיו
  return allOccurrences.sort(
    (a, b) =>
      a.start.getTime() - b.start.getTime() || a.studio.localeCompare(b.studio)
  );
}

// ============================================================
// GUEST: Schedule (read-only RRULE-based timeline)
// ============================================================

/**
 * GET /api/v1/schedule?from=YYYY-MM-DD&to=YYYY-MM-DD
 * מחזיר רשימת שיעורים בפועל (סשנים מתוארכים) לפי חוקים חוזרים ולוח ידני.
 */
export const getSchedule = async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to)
      return res
        .status(400)
        .json({ error: "from & to query params are required" });

    // כעת buildOccurrences מחזיר את הלוח המלא והמתוארך!
    const rows = await buildOccurrences(from, to);
    res.json(rows);
  } catch (err) {
    console.error("getSchedule error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ... [כל שאר הקוד של getManualSchedule, saveManualSchedule, updateCell, deleteManualSchedule, materializeSessions, listSessions, ו-deleteSessions נשארים זהים, מכיוון שהם כבר קוראים ל-buildOccurrences המאוחדת] ...

// ============================================================
// ADMIN: Manual Weekly Grid CRUD
// ============================================================

/**
 * GET /api/v1/schedule/grid
 * טוען לוח ידני
 */
export const getManualSchedule = async (req, res) => {
  // ... הקוד נשאר זהה ...
};
// ... [שאר הפונקציות נשארות זהות] ...

// ============================================================
// ADMIN: Sessions (Generate / Read / Delete)
// ============================================================

/**
 * POST /api/v1/schedule/materialize?from&to
 * יוצר סשנים אמיתיים במסד מתוך הלוח המאוחד (RRULE + Grid)
 */
export const materializeSessions = async (req, res) => {
  // ... הקוד נשאר זהה ...
};
// ... [שאר הפונקציות נשארות זהות] ...
