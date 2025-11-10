// 📁 server/cron/generateSessionsDaily.js
import cron from "node-cron";
import moment from "moment-timezone";
import { generateSessionsFromRules } from "../controllers/sessionController.js";

export function startDailySessionJob() {
  // 🇮🇱 רץ כל יום ב-04:00 בבוקר לפי שעון ישראל
  const tz = "Asia/Jerusalem";

  cron.schedule(
    "0 4 * * *", // 04:00 כל יום
    async () => {
      try {
        const now = moment().tz(tz).format("YYYY-MM-DD HH:mm:ss");
        console.log(`🌅 [${now}] Running daily session generation job...`);

        const result = await generateSessionsFromRules(); // מפעיל את הפונקציה שלך
        console.log(`✅ Sessions generated automatically:`, result);
      } catch (err) {
        console.error("❌ Error in daily session job:", err.message);
      }
    },
    { timezone: tz }
  );
}
