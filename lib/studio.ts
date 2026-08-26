import { DAYS, formatTime, type Day } from "./period";

/**
 * When the studio is actually open. Nothing can be scheduled outside these
 * windows, so they drive the defaults on both the instructor form and the
 * class template — a tap on a day gives you the full open hours for it.
 *
 * Source: the Studio Hours on serenepilates.ca.
 */
export const STUDIO_HOURS: Record<Day, { start: string; end: string }[]> = {
  Mon: [
    { start: "06:30", end: "12:00" },
    { start: "17:30", end: "20:30" },
  ],
  Tue: [
    { start: "06:30", end: "12:00" },
    { start: "17:30", end: "20:30" },
  ],
  Wed: [
    { start: "06:30", end: "12:00" },
    { start: "17:30", end: "20:30" },
  ],
  Thu: [
    { start: "06:30", end: "12:00" },
    { start: "17:30", end: "20:30" },
  ],
  Fri: [
    { start: "07:30", end: "12:00" },
    { start: "16:00", end: "18:00" },
  ],
  Sat: [{ start: "09:00", end: "14:00" }],
  Sun: [{ start: "09:00", end: "14:00" }],
};

/** "6:30 AM – 12:00 PM, 5:30 PM – 8:30 PM" */
export function studioHoursLabel(day: Day): string {
  return STUDIO_HOURS[day]
    .map((w) => `${formatTime(w.start)} – ${formatTime(w.end)}`)
    .join(", ");
}

/** The first window of the day, used to seed a new class slot. */
export function firstWindow(day: Day): { start: string; end: string } {
  return STUDIO_HOURS[day][0];
}

/** True when a time range sits inside one of the day's open windows. */
export function withinStudioHours(
  day: Day,
  start: string,
  end: string
): boolean {
  return STUDIO_HOURS[day].some((w) => w.start <= start && w.end >= end);
}

/** Grouped for display: consecutive days that share the same hours. */
export function studioHoursSummary(): { days: string; hours: string }[] {
  const out: { days: string; hours: string }[] = [];
  for (const day of DAYS) {
    const hours = studioHoursLabel(day);
    const last = out[out.length - 1];
    if (last && last.hours === hours) {
      last.days = `${last.days.split("–")[0]}–${day}`;
    } else {
      out.push({ days: day, hours });
    }
  }
  return out;
}
