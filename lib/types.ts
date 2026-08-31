import type { Category } from "./categories";

export type Instructor = {
  id: string;
  name: string;
  email: string | null;
  invite_token: string;
  formats_taught: string[];
  active: boolean;
  created_at: string;
};

export type AvailabilitySlot = {
  day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
  start: string; // "06:00"
  end: string; // "12:00"
  /**
   * 1-indexed week of the month this window applies to. Omitted (or null) means
   * "every week" — the common case, where an instructor keeps the same days all
   * month. A submission is in per-week mode if any of its slots carry a `week`.
   */
  week?: number | null;
};

/** True when this submission varies week to week rather than repeating. */
export function isPerWeek(slots: AvailabilitySlot[]): boolean {
  return slots.some((s) => typeof s.week === "number");
}

export type AvailabilitySubmission = {
  id: string;
  instructor_id: string;
  period_start: string;
  available_slots: AvailabilitySlot[];
  preferences: string;
  submitted_at: string;
};

export type ClassRequirement = {
  id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  format: string;
  /** "class" (taught) or "shift" (front-of-house cover). See lib/categories.ts. */
  category: Category;
  room: string | null;
  active: boolean;
};

export type ScheduleAssignment = {
  /** Stable key for a single class in the month: requirement + calendar date. */
  requirementId: string;
  date: string; // "2026-09-08" — the actual day this class runs
  day: string; // "Mon" .. "Sun", derived from `date`
  start: string;
  end: string;
  format: string;
  /**
   * Copied from the template entry when the month is planned, so the draft can
   * be grouped and filtered later even if the template changes underneath it.
   * Purely a display/filter tag — the assignment rules ignore it entirely, so a
   * person is never double-booked across a class and a shift.
   */
  category: Category;
  room?: string | null;
  instructorId: string | null;
  instructorName: string | null;
  note?: string;
};

/** Assignments are keyed by requirement *and* date — a weekly class recurs. */
export function assignmentKey(a: Pick<ScheduleAssignment, "requirementId" | "date">) {
  return `${a.requirementId}__${a.date}`;
}

export type Schedule = {
  id: string;
  period_start: string;
  status: "draft" | "approved";
  assignments: ScheduleAssignment[];
  notes: string;
  generated_at: string;
  approved_at: string | null;
  /** When this schedule was last emailed out, and to how many instructors. */
  sent_at: string | null;
  sent_to_count: number;
};
