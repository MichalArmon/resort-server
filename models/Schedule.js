// 📘 controllers/scheduleController.js (מתוקן)
// ... [כל ה-Imports והקונסטנטים נשארים זהים] ...
import Schedule from "../models/Schedule.js"; // נשאר
// ...

// ============================================================
// Helpers
// ============================================================

// יוצר מזהה תאריך ושעה לוקאלי לפי Asia/Jerusalem
function toLocalKeys(date) {
  // ... [הקוד של toLocalKeys נשאר זהה] ...
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
    hourKey: `${String(parts.hour).padStart(2, "0")}:00`,
  };
}

/**
 * בונה אובייקט Date מקומי (ב-Asia/Jerusalem) מתוך תאריך (YYYY-MM-DD) ושעה (HH:MM).
 * (כפי שתוקן בעבר)
 */
function buildLocalDateTime(dateKey, timeKey = "00:00") {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [h, min] = timeKey.split(":").map(Number);
  // יצירת תאריך שמייצג את התאריך והשעה הללו ב-UTC (הגישה המומלצת ל-DB ול-RRule)
  const utcDate = new Date(Date.UTC(y, m - 1, d, h, min));
  return utcDate;
}

// ============================================================
// NEW: מחשב Occurrences מתוך הלוח הידני (Grid)
// ============================================================

/**
 * מפת שמות ימים בפורמט קצר לערכים של JS (0=ראשון, 6=שבת).
 * נניח שהגריד משתמש ב-Mon, Tue, Wed, Thu, Fri, Sat, Sun.
 * JS Date.getDay() מחזיר 0=ראשון, 1=שני... 6=שבת.
 */
const DAY_MAP = {
  Sun: 0, // ראשון
  Mon: 1, // שני
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6, // שבת
};

async function buildGridOccurrences(from, to, weekKey = "default") {
  const fromDate = buildLocalDateTime(from, "00:00");
  const toDate = buildLocalDateTime(to, "23:59");
  const today = new Date(fromDate);
  const rows = [];

  // שליפת תבנית הגריד הידני
  const scheduleDoc = await Schedule.findOne({ weekKey }).populate(
    "grid.workshopId"
  );
  const grid = scheduleDoc?.grid || {};

  if (Object.keys(grid).length === 0) return rows;

  // לולאה על כל יום בטווח התאריכים
  while (today <= toDate) {
    // dayOfWeekLocal יחזיר את היום המקומי (0=ראשון, 6=שבת).
    // עלינו להשתמש ב-TZ כדי לקבל את היום הנכון.
    const dayOfWeekLocal = today.getDay();

    // יצירת מפתח יום (למשל 'Mon') לפי המיפוי ההפוך
    const dayKey = Object.keys(DAY_MAP).find(
      (key) => DAY_MAP[key] === dayOfWeekLocal
    );
    const { dateKey } = toLocalKeys(today);

    if (dayKey && grid[dayKey]) {
      const daySchedule = grid[dayKey];

      // עוברים על השעות בגריד עבור היום הזה
      for (const hourKey in daySchedule) {
        const studios = daySchedule[hourKey];

        // עוברים על הסטודיואים באותה שעה
        for (const studioName in studios) {
          const workshopId = studios[studioName];
          if (!workshopId) continue; // סשן ריק

          // נניח ש-workshopId הוא ID חוקי
          const workshop = await Workshop.findById(workshopId).lean(); // נצטרך לייבא את מודל Workshop!

          // יצירת אובייקט Date ספציפי לסשן
          const startLocal = buildLocalDateTime(dateKey, hourKey);

          // חישוב זמן סיום (נניח ששעת הסיום לא מוגדרת בגריד, נשתמש ב-60 דקות כברירת מחדל)
          const durationMin =
            workshop?.durationMin > 0 ? workshop.durationMin : 60;
          const endLocal = new Date(startLocal.getTime() + durationMin * 60000);

          rows.push({
            source: "manual",
            date: dateKey,
            hour: hourKey,
            start: startLocal,
            end: endLocal,
            studio: studioName,
            workshopId: workshop?._id || workshopId, // אם לא נמצא, נשמור את ה-ID
            workshopSlug: workshop?.slug || null,
            workshopTitle: workshop?.title || "(Untitled workshop - Manual)",
            ruleId: null, // אין Rule ID לסשן ידני
          });
        }
      }
    }

    // מקדמים את התאריך ביום אחד
    today.setDate(today.getDate() + 1);
  }

  return rows;
}

// ============================================================
// REFACTORED: מחשב Occurrences מתוך RecurringRule AND Manual Grid
// ============================================================

async function buildOccurrences(from, to) {
  // 1. מחשבים הופעות מ-RRULE
  const rruleOccurrences = await buildRRuleOccurrences(from, to);

  // 2. מחשבים הופעות מה-Grid הידני
  const gridOccurrences = await buildGridOccurrences(from, to);

  // 3. איחוד וסינון כפילויות (אם נדרש סינון)
  // כרגע נניח ששני המקורות פועלים במקביל.
  let allOccurrences = [...rruleOccurrences, ...gridOccurrences];

  // 4. מיון סופי
  return allOccurrences.sort((a, b) =>
    (a.date + a.hour + a.studio).localeCompare(b.date + b.hour + b.studio)
  );
}

// הפונקציה המקורית שחושבה מ-RRULE מועברת לפונקציה פנימית חדשה
async function buildRRuleOccurrences(from, to) {
  const fromDate = buildLocalDateTime(from, "00:00");
  const toDate = buildLocalDateTime(to, "23:59");

  const rules = await RecurringRule.find({ isActive: true }).populate(
    "workshopId"
  );
  const rows = [];

  // ... [כל הלולאה הקודמת נשארת זהה ומחושבת לתוך rows] ...

  for (const rule of rules) {
    let opts;
    try {
      opts = RRule.parseString(rule.rrule);
    } catch {
      continue;
    }

    let dtstart = new Date();
    if (rule.effectiveFrom) {
      const maybe = buildLocalDateTime(
        rule.effectiveFrom,
        rule.startTime || "00:00"
      );
      if (!isNaN(maybe.getTime())) dtstart = maybe;
    }

    if (dtstart instanceof Date && !isNaN(dtstart.getTime())) {
      opts.dtstart = dtstart;
    } else {
      console.warn(
        `⚠️ Skipping rule ${rule._id}: invalid dtstart/effectiveFrom`
      );
      continue;
    }

    if (rule.effectiveTo) {
      const until = buildLocalDateTime(rule.effectiveTo, "23:59");
      until.setSeconds(59, 999);
      opts.until = until;
    }

    opts.tzid = TZ; // ודא ש-TZID מוגדר

    let r;
    try {
      r = new RRule(opts);
    } catch (e) {
      console.warn(
        `⚠️ Skipping rule ${rule._id}: RRule construction error. Error: ${e.message}`
      );
      continue;
    }

    const occ = r.between(fromDate, toDate, true);
    const excSet = new Set((rule.exceptions || []).map((d) => d));

    for (const startLocal of occ) {
      const { dateKey, hourKey } = toLocalKeys(startLocal);
      if (excSet.has(dateKey)) continue;

      const durationMin = rule.durationMin > 0 ? rule.durationMin : 60;
      const endLocal = new Date(startLocal.getTime() + durationMin * 60000);

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

  return rows;
}
// ... [כל שאר הקוד של getSchedule, getManualSchedule ו-materializeSessions נשארים זהים, כיוון שהם קוראים ל-buildOccurrences שמעכשיו מאוחד] ...
