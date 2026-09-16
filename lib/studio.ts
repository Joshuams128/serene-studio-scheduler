import { DAYS, formatTime, type Day } from "./period";

/**
 * When the studio is open. Nothing is checked against these hours — they
 * only drive the defaults on the instructor form and the weekly template,
 * plus the background context sent to the schedule generator. Stored in the
 * `studio_hours` table so the owner can change it from the dashboard; this
 * is just the fallback used before that table has ever been read.
 */
export type StudioHours = Record<Day, { start: string; end: string }>;

export const DEFAULT_STUDIO_HOURS: StudioHours = {
  Mon: { start: "06:00", end: "21:00" },
  Tue: { start: "06:00", end: "21:00" },
  Wed: { start: "06:00", end: "21:00" },
  Thu: { start: "06:00", end: "21:00" },
  Fri: { start: "06:00", end: "21:00" },
  Sat: { start: "06:00", end: "21:00" },
  Sun: { start: "06:00", end: "21:00" },
};

/** A `studio_hours` row as it comes back from Supabase. */
export type StudioHoursRow = {
  day_of_week: string;
  start_time: string;
  end_time: string;
};

/**
 * Postgres rows -> the shape the app works with, falling back to the
 * defaults for any day that's missing a row (e.g. before the table exists
 * or has been seeded).
 */
export function normalizeStudioHours(
  rows: StudioHoursRow[] | null | undefined
): StudioHours {
  const hours = { ...DEFAULT_STUDIO_HOURS };
  for (const row of rows ?? []) {
    if ((DAYS as readonly string[]).includes(row.day_of_week)) {
      hours[row.day_of_week as Day] = {
        start: row.start_time.slice(0, 5),
        end: row.end_time.slice(0, 5),
      };
    }
  }
  return hours;
}

/** "6:00 AM – 9:00 PM" */
export function studioHoursLabel(hours: StudioHours, day: Day): string {
  const w = hours[day];
  return `${formatTime(w.start)} – ${formatTime(w.end)}`;
}

/**
 * The day's open window, used to seed a sensible default on a new entry.
 * Only a convenience — the owner sets whatever times she likes, and nothing
 * is checked against opening hours.
 */
export function firstWindow(
  hours: StudioHours,
  day: Day
): { start: string; end: string } {
  return hours[day];
}

/** Grouped for display: consecutive days that share the same hours. */
export function studioHoursSummary(
  hours: StudioHours
): { days: string; hours: string }[] {
  const out: { days: string; hours: string }[] = [];
  for (const day of DAYS) {
    const label = studioHoursLabel(hours, day);
    const last = out[out.length - 1];
    if (last && last.hours === label) {
      last.days = `${last.days.split("–")[0]}–${day}`;
    } else {
      out.push({ days: day, hours: label });
    }
  }
  return out;
}
