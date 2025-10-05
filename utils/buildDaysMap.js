import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
dayjs.extend(utc);

export function buildDaysMap(retreats, monthStartUtc, monthEndUtc) {
  const daysMap = {};

  for (const r of retreats) {
    const rStart = dayjs.utc(r.startDate);
    const rEnd = dayjs.utc(r.endDate);

    // גבולות בתוך החודש הנוכחי:
    const start = rStart.isAfter(monthStartUtc) ? rStart : monthStartUtc;
    const end = rEnd.isBefore(monthEndUtc) ? rEnd : monthEndUtc;

    let cursor = start.startOf("day");
    const last = end.startOf("day");

    while (cursor.isBefore(last) || cursor.isSame(last)) {
      const key = cursor.format("YYYY-MM-DD");
      daysMap[key] = {
        id: String(r._id),
        type: r.type,
        name: r.name,
        soldOut: !!r.soldOut,
      };
      cursor = cursor.add(1, "day");
    }
  }

  return daysMap;
}
