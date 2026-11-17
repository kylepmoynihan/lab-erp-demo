// The lab runs on Arizona time (America/Phoenix, UTC-7 all year, no DST),
// so day and week boundaries can be computed with a fixed offset.
export const TZ = "America/Phoenix";
const OFFSET_MS = -7 * 3600_000;
const DAY_MS = 86_400_000;
export const MIN = 60_000;
export const HOUR = 3_600_000;

/** Day number (days since 1970-01-01) in Phoenix time. */
export const phxDay = (ts: number) => Math.floor((ts + OFFSET_MS) / DAY_MS);
/** Epoch ms of midnight Phoenix time for a day number. */
export const dayStart = (day: number) => day * DAY_MS - OFFSET_MS;
/** Epoch ms at a given hour (may be fractional) of a Phoenix day. */
export const at = (day: number, hour: number) => dayStart(day) + hour * HOUR;
/** 0 = Sunday ... 6 = Saturday. 1970-01-01 was a Thursday. */
export const dow = (day: number) => (((day + 4) % 7) + 7) % 7;
export const isBusinessDay = (day: number) => dow(day) >= 1 && dow(day) <= 5;

export function addBusinessDays(day: number, n: number) {
  let d = day;
  let left = n;
  while (left > 0) {
    d += 1;
    if (isBusinessDay(d)) left -= 1;
  }
  return d;
}

export const fmtTime = (ts: number) =>
  new Date(ts).toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
export const fmtDate = (ts: number) =>
  new Date(ts).toLocaleDateString("en-US", { timeZone: TZ, month: "short", day: "numeric" });
export const fmtDateTime = (ts: number) => `${fmtDate(ts)}, ${fmtTime(ts)}`;
export const fmtDayLong = (ts: number) =>
  new Date(ts).toLocaleDateString("en-US", { timeZone: TZ, weekday: "long", month: "long", day: "numeric" });

export type RangeKey = "today" | "week" | "last7" | "last30" | "month";
export const RANGE_LABELS: Record<RangeKey, string> = {
  today: "Today",
  week: "This week",
  last7: "Last 7 business days",
  last30: "Last 30 business days",
  month: "This month",
};

/** Ranges start at midnight Phoenix time and run to now. No hourly sliding. */
export function rangeBounds(key: RangeKey, now: number): { start: number; end: number } {
  const today = phxDay(now);
  let startDay = today;
  if (key === "week") {
    const offset = (dow(today) + 6) % 7; // Monday-start weeks
    startDay = today - offset;
  } else if (key === "last7" || key === "last30") {
    const want = key === "last7" ? 7 : 30;
    let count = isBusinessDay(today) ? 1 : 0;
    while (count < want) {
      startDay -= 1;
      if (isBusinessDay(startDay)) count += 1;
    }
  } else if (key === "month") {
    const d = new Date(now + OFFSET_MS);
    startDay = phxDay(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - OFFSET_MS);
  }
  return { start: dayStart(startDay), end: now };
}

export function median(xs: number[]) {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
