// Who could take a given class? Shared by the schedule generator (server) and
// the draft grid (client), so the dashboard's suggestions always agree with
// the rules the generator enforces. Keep this file free of server imports.

import type {
  AvailabilitySubmission,
  Instructor,
  ScheduleAssignment,
} from "./types";

/** Postgres `time` comes back as "09:00:00"; everything here compares "09:00". */
function hhmm(time: string): string {
  return time.slice(0, 5);
}

/**
 * Why this person can't teach the class based on what they told us, or null
 * if they can. Doesn't look at what else they're already teaching.
 */
export function unavailableReason(
  instructor: Instructor,
  submission: AvailabilitySubmission | undefined,
  a: Pick<ScheduleAssignment, "day" | "start" | "end" | "format">,
  week: number | undefined
): string | null {
  if (!submission) return "hasn't sent availability";
  if (instructor.formats_taught.length > 0 && !instructor.formats_taught.includes(a.format)) {
    return `doesn't teach ${a.format}`;
  }
  const free = submission.available_slots.some(
    (slot) =>
      slot.day === a.day &&
      (slot.week == null || slot.week === week) &&
      hhmm(slot.start) <= a.start &&
      hhmm(slot.end) >= a.end
  );
  return free ? null : "not available then";
}

/** Everything that stops this person taking the class, or null if nothing does. */
export function blockedReason(
  instructor: Instructor,
  submission: AvailabilitySubmission | undefined,
  target: ScheduleAssignment,
  all: ScheduleAssignment[],
  weeks: Map<string, number>
): string | null {
  const week = weeks.get(target.date);
  const basic = unavailableReason(instructor, submission, target, week);
  if (basic) return basic;

  const others = all.filter((o) => o !== target && o.instructorId === instructor.id);
  if (others.some((o) => o.date === target.date && target.start < o.end && o.start < target.end)) {
    return "teaching at that time";
  }
  const cap = submission?.max_per_week;
  if (cap != null && others.filter((o) => weeks.get(o.date) === week).length >= cap) {
    return `at their ${cap}-a-week limit`;
  }
  return null;
}
