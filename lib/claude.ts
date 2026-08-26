import Anthropic from "@anthropic-ai/sdk";
import type {
  AvailabilitySubmission,
  ClassRequirement,
  Instructor,
  ScheduleAssignment,
} from "./types";
import { datesInMonth, dayOfDate, monthLabel } from "./period";

/** Postgres `time` comes back as "09:00:00"; everything here compares "09:00". */
function hhmm(time: string): string {
  return time.slice(0, 5);
}

type PlannedClass = {
  n: number; // compact index Claude refers back to
  requirementId: string;
  date: string;
  day: string;
  start: string;
  end: string;
  format: string;
  room: string | null;
};

/**
 * Expand the studio's weekly template across every week of the month.
 * Deliberately done in code, not by the model: dates are arithmetic, and this
 * guarantees no class is ever dropped or invented.
 */
export function planMonth(
  periodStart: string,
  requirements: ClassRequirement[]
): PlannedClass[] {
  const active = requirements.filter((r) => r.active !== false);
  const classes: PlannedClass[] = [];

  for (const date of datesInMonth(periodStart)) {
    const day = dayOfDate(date);
    for (const r of active.filter((r) => r.day_of_week === day)) {
      classes.push({
        n: classes.length,
        requirementId: r.id,
        date,
        day,
        start: hhmm(r.start_time),
        end: hhmm(r.end_time),
        format: r.format,
        room: r.room,
      });
    }
  }

  return classes.sort((a, b) =>
    a.date === b.date ? a.start.localeCompare(b.start) : a.date.localeCompare(b.date)
  );
}

const SCHEDULE_TOOL = {
  name: "propose_schedule",
  description:
    "Return one entry for every class in the month, naming the instructor who should cover it.",
  input_schema: {
    type: "object" as const,
    properties: {
      assignments: {
        type: "array",
        items: {
          type: "object",
          properties: {
            n: {
              type: "integer",
              description: "The class index, exactly as given in the class list",
            },
            instructorId: {
              type: ["string", "null"],
              description: "null if no available instructor can cover this class",
            },
            note: {
              type: "string",
              description:
                "Optional short note — why it's unfilled, or a preference traded off",
            },
          },
          required: ["n", "instructorId"],
        },
      },
      summary: {
        type: "string",
        description:
          "A short plain-language summary for the studio owner: unfilled classes, anyone carrying a heavy load, any preference that couldn't be honoured.",
      },
    },
    required: ["assignments", "summary"],
  },
};

export async function generateSchedule({
  periodStart,
  instructors,
  submissions,
  requirements,
}: {
  periodStart: string;
  instructors: Instructor[];
  submissions: AvailabilitySubmission[];
  requirements: ClassRequirement[];
}): Promise<{ assignments: ScheduleAssignment[]; summary: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY environment variable");

  const classes = planMonth(periodStart, requirements);
  if (classes.length === 0) {
    return {
      assignments: [],
      summary: `No classes fall in ${monthLabel(periodStart)} — add your weekly timetable first.`,
    };
  }

  const client = new Anthropic({ apiKey });

  const instructorData = instructors.map((i) => {
    const sub = submissions.find((s) => s.instructor_id === i.id);
    return {
      id: i.id,
      name: i.name,
      formatsTaught: i.formats_taught,
      // Weekly recurring windows — they apply to every week of the month.
      availableSlots: (sub?.available_slots ?? []).map((s) => ({
        day: s.day,
        start: hhmm(s.start),
        end: hhmm(s.end),
      })),
      preferences: sub?.preferences ?? "",
      hasSubmitted: Boolean(sub),
    };
  });

  const message = await client.messages.create({
    model: "claude-sonnet-5",
    // A month of classes means one entry per class in the response — 4k would
    // truncate the tool call partway through a busy timetable.
    max_tokens: 16000,
    system:
      "You are a scheduling assistant for a pilates studio. You are given every " +
      "class that runs in one calendar month, each with a real date, plus each " +
      "instructor's weekly availability, the formats they teach, and their " +
      "written preferences. Assign an instructor to every class.\n\n" +
      "Hard rules you must never break:\n" +
      "1. Only assign an instructor to a class that falls inside one of their " +
      "weekly availability windows for that weekday (class start and end must " +
      "both sit within a single window).\n" +
      "2. Never assign an instructor to a format they don't teach.\n" +
      "3. Never double-book an instructor into two classes that overlap in time " +
      "on the same date.\n" +
      "4. An instructor with hasSubmitted: false must not be assigned anywhere.\n" +
      "5. Return exactly one entry per class index, covering every index given.\n\n" +
      "Soft goals — trade off sensibly when they conflict:\n" +
      "- Honour written preferences, including one-off dates. Preferences are " +
      "free text and may mention specific dates or weeks off; read them " +
      "carefully and respect them for those dates only.\n" +
      "- Spread classes fairly across instructors over the whole month, and keep " +
      "each instructor's week reasonably consistent.\n" +
      "- Prefer giving the same instructor the same recurring class each week, " +
      "so members see a familiar face.\n" +
      "- Leave a class unassigned (instructorId: null) rather than break a hard " +
      "rule, and call it out in the summary so the owner knows to cover it.\n\n" +
      "Always respond by calling the propose_schedule tool.",
    tools: [SCHEDULE_TOOL],
    tool_choice: { type: "tool", name: "propose_schedule" },
    messages: [
      {
        role: "user",
        content:
          `Month: ${monthLabel(periodStart)} (starts ${periodStart})\n` +
          `Weekdays are given per class; availability windows repeat weekly.\n\n` +
          `Instructors:\n${JSON.stringify(instructorData, null, 2)}\n\n` +
          `Classes to fill (${classes.length}):\n${JSON.stringify(
            classes.map(({ n, date, day, start, end, format, room }) => ({
              n,
              date,
              day,
              start,
              end,
              format,
              room,
            })),
            null,
            2
          )}`,
      },
    ],
  });

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );

  if (!toolUse) {
    throw new Error("Claude did not return a schedule via the expected tool call");
  }

  const result = toolUse.input as {
    assignments: { n: number; instructorId: string | null; note?: string }[];
    summary: string;
  };

  const chosen = new Map(
    (result.assignments ?? []).map((a) => [a.n, a] as const)
  );

  const assignments = classes.map((c) => {
    const pick = chosen.get(c.n);
    const instructor = pick?.instructorId
      ? instructors.find((i) => i.id === pick.instructorId)
      : undefined;

    return {
      requirementId: c.requirementId,
      date: c.date,
      day: c.day,
      start: c.start,
      end: c.end,
      format: c.format,
      room: c.room,
      instructorId: instructor?.id ?? null,
      instructorName: instructor?.name ?? null,
      note: pick?.note,
    } satisfies ScheduleAssignment;
  });

  const violations = enforceHardRules(assignments, instructors, submissions);

  return {
    assignments,
    summary: violations.length
      ? `${result.summary}\n\nAutomatically unassigned ${violations.length} class${
          violations.length === 1 ? "" : "es"
        } that broke a scheduling rule: ${violations.join("; ")}.`
      : result.summary,
  };
}

/**
 * Belt-and-braces pass over the model's output. The hard rules are the ones an
 * owner would notice immediately and lose trust over — a wrong assignment is
 * worse than an empty one, so anything that breaks a rule is cleared and
 * flagged in the summary rather than quietly shipped.
 */
function enforceHardRules(
  assignments: ScheduleAssignment[],
  instructors: Instructor[],
  submissions: AvailabilitySubmission[]
): string[] {
  const problems: string[] = [];
  const taken = new Map<string, ScheduleAssignment[]>(); // `${instructorId}|${date}`

  const clear = (a: ScheduleAssignment, why: string) => {
    problems.push(`${a.instructorName} on ${a.date} (${why})`);
    a.instructorId = null;
    a.instructorName = null;
    a.note = why;
  };

  for (const a of assignments) {
    if (!a.instructorId) continue;

    const instructor = instructors.find((i) => i.id === a.instructorId);
    const submission = submissions.find((s) => s.instructor_id === a.instructorId);

    if (!instructor || !submission) {
      clear(a, "no availability submitted");
      continue;
    }

    if (
      instructor.formats_taught.length > 0 &&
      !instructor.formats_taught.includes(a.format)
    ) {
      clear(a, `doesn't teach ${a.format}`);
      continue;
    }

    const covered = submission.available_slots.some(
      (slot) =>
        slot.day === a.day &&
        hhmm(slot.start) <= a.start &&
        hhmm(slot.end) >= a.end
    );
    if (!covered) {
      clear(a, "outside submitted availability");
      continue;
    }

    const key = `${a.instructorId}|${a.date}`;
    const sameDay = taken.get(key) ?? [];
    if (sameDay.some((other) => a.start < other.end && other.start < a.end)) {
      clear(a, "double-booked");
      continue;
    }
    sameDay.push(a);
    taken.set(key, sameDay);
  }

  return problems;
}
