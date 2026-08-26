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
};

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
};
