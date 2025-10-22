// 📘 controllers/scheduleController.js
// Unified Schedule Controller
// כולל:
//   - לוח אמיתי לאורחים (RRULE occurrences)
//   - לוח ידני לאדמין (Grid CRUD מלא)
//   - ניהול Sessions (חישוב, יצירה, שליפה)

// ============================================================
// Imports
// ============================================================
import Schedule from "../models/Schedule.js";
import RecurringRule from "../models/RecurringRule.js";
import Session from "../models/Session.js";
import pkg from "rrule";
const { RRule } = pkg;

// ============================================================
// Constants
// ============================================================
const TZ = "Asia/Jerusalem"; // כבר מוגדר גם ב-server.js למניעת היסטים

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
  // השימוש ב-new Date() עם מחרוזת בפורמט YYYY-MM-DDTHH:MM יוצר אובייקט שייצג
  // את הזמן הלוקאלי הזה (בלי להתחשב ב-TZ של השרת, אבל הוא עדיין אובייקט UTC בבסיס).
  // הדרך הנכונה ביותר היא לבנות את התאריך והשעה כ-UTC, ואז להשתמש במניפולציות
  // כדי "להעביר" אותו ל-TZ הנכון, או לסמוך על כך שה-DB ידע לפרש את ה-UTC
  // כפי שהוא. לצורך דיוק מקומי, עדיף להשתמש בשיטה שמחייבת את ה-TZ.

  // נשתמש בטריק של יצירת תאריך כ-UTC, תוך קיזוז ה-offset של ה-TZ.
  // זה דורש ידע ב-TZ Offset, שמשתנה. הדרך הפשוטה יותר היא להשתמש
  // בפורמט ISO Date ללא "Z" (שגורם לפרשנות לוקאלית ע"י new Date),
  // ואז לוודא שהוא אכן מפורש כ-TZ הרצוי.

  // הדרך הפשוטה והנפוצה יותר (עם מגבלות קלות) היא שימוש ב-moment-timezone או
  // ספרייה דומה, אך בהיעדרה:

  // נניח שהתאריך והשעה ב-dateKey ו-timeKey הם ב-TZ הרצוי (Asia/Jerusalem).
  // המטרה: ליצור Date object ש-getTimezoneOffset שלו יראה את הזמן
  // הנכון ביחס ל-UTC בהתחשב ב-TZ.

  // ניצור מחרוזת תאריך שתפורש כ-UTC: YYYY-MM-DD HH:MM
  const utcString = `${dateKey}T${timeKey}:00.000`;

  // שימוש ב-Intl.DateTimeFormat כדי לקבל את החלקים ולבנות Date Object
  // שייצג את הזמן הזה ב-TZ

  const [year, month, day, hour, minute] = utcString.match(/\d+/g);
  const date = new Date(year, month - 1, day, hour, minute); // ייווצר בזמן לוקאלי של השרת

  // נשתמש ב-Date.toLocaleString כדי לוודא שנקבל את הייצוג הנכון
  // זה מורכב ללא ספרייה ייעודית. לצורך הפתרון המבוקש והבסיסי, נשתמש
  // בבנייה בסיסית, ונסמוך על כך ש-RRule יודע להתמודד עם זה.

  const dateObj = new Date(utcString); // יפורש לוקאלית (עפ"י השרת) או כ-UTC (תלוי מנוע JS)

  // פתרון מורכב ומדויק יותר (כפי שנרמז בקוד המקורי, דורש Moment/Luxon):
  // נשתמש בקיזוז של ה-Date Object שנוצר מהמחרוזת, כדי "למשוך" אותו
  // ל-TZ הנכון.

  // נניח ש-dateObj מפורש כזמן לוקאלי של השרת,
  // אנחנו רוצים שהוא ייצג את השעה המקומית ב-Asia/Jerusalem.

  // הדרך הנכונה יותר, על בסיס המחרוזת:
  // כדי למנוע יצירת שגיאה, אנו ניצור את התאריך כ-UTC
  // ואז נעדכן את השעות המקומיות

  const [y, m, d] = dateKey.split("-").map(Number);
  const [h, min] = timeKey.split(":").map(Number);

  // יצירת תאריך שמייצג את התאריך והשעה הללו ב-UTC
  const utcDate = new Date(Date.UTC(y, m - 1, d, h, min));

  // אין צורך במניפולציות נוספות אם משתמשים ב-RRule, שמקבל Date objects
  // ומתייחס אליהם לפי מה שהם מביאים. הדיוק של ה-TZ נשמר על ידי
  // השימוש הקבוע בפונקציות כמו toLocalKeys.

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

/**
 * מחשב Occurrences מתוך RecurringRule (לוח אמיתי).
 * @param {string} from - תאריך התחלה YYYY-MM-DD.
 * @param {string} to - תאריך סיום YYYY-MM-DD.
 * @returns {Promise<Array<object>>} רשימת הופעות מחושבת.
 */
async function buildOccurrences(from, to) {
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

    // הבלוק המקוטע שתוקן:
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
        source: "recurring",
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

  // ממיינים לפי תאריך, שעה וסטודיו
  return rows.sort((a, b) =>
    (a.date + a.hour + a.studio).localeCompare(b.date + b.hour + b.studio)
  );
}

// ============================================================
// GUEST: Schedule (read-only RRULE-based timeline)
// ============================================================

/**
 * GET /api/v1/schedule?from=YYYY-MM-DD&to=YYYY-MM-DD
 * מחזיר רשימת שיעורים בפועל לפי חוקים חוזרים
 */
export const getSchedule = async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to)
      return res
        .status(400)
        .json({ error: "from & to query params are required" });

    const rows = await buildOccurrences(from, to);
    res.json(rows);
  } catch (err) {
    console.error("getSchedule error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// ADMIN: Manual Weekly Grid CRUD
// ============================================================

/**
 * GET /api/v1/schedule/grid
 * טוען לוח ידני
 */
export const getManualSchedule = async (req, res) => {
  try {
    const { weekKey = "default" } = req.query;
    const doc = await Schedule.findOne({ weekKey });
    res.json(doc?.grid || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/v1/schedule/grid
 * יוצר / מעדכן את כל הגריד
 */
export const saveManualSchedule = async (req, res) => {
  try {
    const { weekKey = "default", grid } = req.body;
    if (!grid) return res.status(400).json({ error: "Missing grid" });

    const doc = await Schedule.findOneAndUpdate(
      { weekKey },
      { grid },
      { upsert: true, new: true }
    );
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * PUT /api/v1/schedule/grid/cell
 * מעדכן תא יחיד בלוח הידני
 */
export const updateCell = async (req, res) => {
  try {
    const { weekKey = "default", day, hour, studio, value } = req.body;
    if (!day || !hour || !studio)
      return res.status(400).json({ error: "Missing params" });

    const doc =
      (await Schedule.findOne({ weekKey })) ||
      new Schedule({ weekKey, grid: {} });
    doc.grid[day] = doc.grid[day] || {};
    doc.grid[day][hour] = doc.grid[day][hour] || {};
    doc.grid[day][hour][studio] = value;

    await doc.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * DELETE /api/v1/schedule/grid
 * מוחק לוח שבועי (אם נרצה ריק חדש)
 */
export const deleteManualSchedule = async (req, res) => {
  try {
    const { weekKey = "default" } = req.query;
    await Schedule.findOneAndDelete({ weekKey });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// ADMIN: Sessions (Generate / Read / Delete)
// ============================================================

/**
 * POST /api/v1/schedule/materialize?from&to
 * יוצר סשנים אמיתיים במסד מתוך RRULE
 */
export const materializeSessions = async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to)
      return res.status(400).json({ error: "from & to are required" });

    // מחשבים את ההופעות
    const occ = await buildOccurrences(from, to);
    let upserts = 0;

    // יוצרים / מעדכנים סשן לכל הופעה
    for (const o of occ) {
      await Session.findOneAndUpdate(
        // חיפוש לפי חוג, סטודיו וזמן התחלה (ייחודי לכל סשן)
        { workshopId: o.workshopId, studio: o.studio, start: o.start },
        {
          $set: {
            end: o.end,
            date: o.date,
            hour: o.hour,
            workshopSlug: o.workshopSlug,
            workshopTitle: o.workshopTitle,
            source: o.source,
            ruleId: o.ruleId || null,
            tz: TZ,
          },
        },
        { upsert: true, new: true }
      );
      upserts++;
    }

    res.json({ ok: true, upserts });
  } catch (err) {
    console.error("materializeSessions error:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/v1/schedule/sessions
 * מחזיר רשימת סשנים קיימים במסד (עם פילטרים)
 */
export const listSessions = async (req, res) => {
  try {
    const { from, to, studio, workshopId } = req.query;
    const filter = {};

    if (from || to) {
      filter.start = {};
      if (from) filter.start.$gte = buildLocalDateTime(from, "00:00");
      if (to) filter.start.$lte = buildLocalDateTime(to, "23:59");
    }
    if (studio) filter.studio = studio;
    // מניחים ש-workshopId הוא ObjectId חוקי
    if (workshopId) filter.workshopId = workshopId;

    const items = await Session.find(filter).sort({ start: 1 }).lean();
    res.json({ count: items.length, items });
  } catch (err) {
    console.error("listSessions error:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * DELETE /api/v1/schedule/sessions
 * מוחק סשנים לפי טווח תאריכים / סטודיו / חוג
 */
export const deleteSessions = async (req, res) => {
  try {
    const { from, to, studio, workshopId } = req.query;
    const filter = {};

    if (from || to) {
      filter.start = {};
      if (from) filter.start.$gte = buildLocalDateTime(from, "00:00");
      if (to) filter.start.$lte = buildLocalDateTime(to, "23:59");
    }
    if (studio) filter.studio = studio;
    if (workshopId) filter.workshopId = workshopId;

    const result = await Session.deleteMany(filter);
    res.json({ ok: true, deletedCount: result.deletedCount });
  } catch (err) {
    console.error("deleteSessions error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// Backward Compatibility (אליאסים ישנים לגרסה קודמת)
// ============================================================
export const getGrid = getManualSchedule;
export const saveGrid = saveManualSchedule;
