// Scheduling periods are calendar months. A period is identified everywhere by
// the ISO date of its first day, e.g. "2026-09-01" — that string is the
// `period_start` primary key on both submissions and schedules.

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type Day = (typeof DAYS)[number];

export const DAY_LABELS: Record<Day, string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};

// Dates are built and formatted in local time throughout. Going via
// `toISOString()` would shift the day for anyone west of UTC and silently move
// a schedule into the wrong month.
function iso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function parse(periodStart: string): Date {
  const [y, m, d] = periodStart.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function currentMonthStart(): string {
  const now = new Date();
  return iso(new Date(now.getFullYear(), now.getMonth(), 1));
}

export function addMonths(periodStart: string, months: number): string {
  const d = parse(periodStart);
  return iso(new Date(d.getFullYear(), d.getMonth() + months, 1));
}

export function nextMonthStart(): string {
  return addMonths(currentMonthStart(), 1);
}

/** "September 2026" */
export function monthLabel(periodStart: string): string {
  return parse(periodStart).toLocaleDateString("en-CA", {
    month: "long",
    year: "numeric",
  });
}

/** "Sep 2026" */
export function monthLabelShort(periodStart: string): string {
  return parse(periodStart).toLocaleDateString("en-CA", {
    month: "short",
    year: "numeric",
  });
}

/** Normalises any ISO date to the first of its month. */
export function toMonthStart(value: string): string {
  const d = parse(value);
  return iso(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function isValidPeriod(value: string | null | undefined): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Every date in the month, in order. */
export function datesInMonth(periodStart: string): string[] {
  const start = parse(periodStart);
  const month = start.getMonth();
  const out: string[] = [];
  const cursor = new Date(start.getFullYear(), month, 1);
  while (cursor.getMonth() === month) {
    out.push(iso(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

export function dayOfDate(date: string): Day {
  // getDay() is 0=Sun; DAYS is Mon-first.
  const idx = (parse(date).getDay() + 6) % 7;
  return DAYS[idx];
}

/** "Tue, Sep 8" */
export function formatDate(date: string): string {
  return parse(date).toLocaleDateString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** "Sep 8" */
export function formatDateShort(date: string): string {
  return parse(date).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
  });
}

export type Week = { index: number; label: string; dates: string[] };

/**
 * Which week of the month a date falls in, 1-indexed to match the `week` field
 * on an availability slot. Returns 0 if the date isn't in this month at all.
 */
export function weekNumberForDate(periodStart: string, date: string): number {
  const weeks = weeksInMonth(periodStart);
  const idx = weeks.findIndex((w) => w.dates.includes(date));
  return idx === -1 ? 0 : idx + 1;
}

/** The weekdays that actually occur in a week — the first and last are partial. */
export function daysInWeek(week: Week): Day[] {
  return week.dates.map(dayOfDate);
}

/**
 * The month split into Monday-started weeks, keeping only the dates that fall
 * inside the month itself — the first and last week are usually partial.
 */
export function weeksInMonth(periodStart: string): Week[] {
  const weeks: Week[] = [];
  let current: string[] = [];

  for (const date of datesInMonth(periodStart)) {
    if (dayOfDate(date) === "Mon" && current.length > 0) {
      weeks.push({ index: weeks.length, label: "", dates: current });
      current = [];
    }
    current.push(date);
  }
  if (current.length > 0) {
    weeks.push({ index: weeks.length, label: "", dates: current });
  }

  return weeks.map((w) => ({
    ...w,
    label: `Week ${w.index + 1} · ${formatDateShort(w.dates[0])}–${formatDateShort(
      w.dates[w.dates.length - 1]
    )}`,
  }));
}

/** "9:00 AM" from a "09:00" or "09:00:00" time string. */
export function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}
