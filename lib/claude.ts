import Anthropic from "@anthropic-ai/sdk";
import type {
  AvailabilitySubmission,
  ClassRequirement,
  Instructor,
  ScheduleAssignment,
} from "./types";

const SCHEDULE_TOOL = {
  name: "propose_schedule",
  description:
    "Return the proposed class schedule, assigning one instructor to every required slot where possible.",
  input_schema: {
    type: "object" as const,
    properties: {
      assignments: {
        type: "array",
        items: {
          type: "object",
          properties: {
            requirementId: { type: "string" },
            day: { type: "string" },
            start: { type: "string" },
            end: { type: "string" },
            format: { type: "string" },
            instructorId: {
              type: ["string", "null"],
              description: "null if no available instructor could cover this slot",
            },
            instructorName: { type: ["string", "null"] },
            note: {
              type: "string",
              description:
                "Optional short note, e.g. why a slot is unfilled, or a preference tradeoff that was made",
            },
          },
          required: ["requirementId", "day", "start", "end", "format", "instructorId", "instructorName"],
        },
      },
      summary: {
        type: "string",
        description:
          "A short plain-language summary of the draft for the studio owner: any unfilled slots, any instructor overloaded, any preference that couldn't be honored.",
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

  const client = new Anthropic({ apiKey });

  const instructorData = instructors.map((i) => {
    const sub = submissions.find((s) => s.instructor_id === i.id);
    return {
      id: i.id,
      name: i.name,
      formatsTaught: i.formats_taught,
      availableSlots: sub?.available_slots ?? [],
      preferences: sub?.preferences ?? "",
      hasSubmitted: Boolean(sub),
    };
  });

  const requirementData = requirements
    .filter((r) => r.active)
    .map((r) => ({
      id: r.id,
      day: r.day_of_week,
      start: r.start_time,
      end: r.end_time,
      format: r.format,
      room: r.room,
    }));

  const message = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 4096,
    system:
      "You are a scheduling assistant for a fitness/pilates studio with multiple " +
      "instructors. Given each instructor's availability, the formats they teach, " +
      "and their preferences, plus the studio's required weekly class slots, " +
      "produce a schedule assignment.\n\n" +
      "Hard rules you must never break:\n" +
      "1. Never assign an instructor to a slot outside their submitted availability.\n" +
      "2. Never assign an instructor to a format they don't teach.\n" +
      "3. Never double-book an instructor into two overlapping slots.\n" +
      "4. An instructor who has not submitted availability (hasSubmitted: false) " +
      "must not be assigned anywhere.\n\n" +
      "Soft goals, best-effort, trade off sensibly when they conflict:\n" +
      "- Respect stated preferences where possible.\n" +
      "- Balance the number of classes across instructors reasonably fairly.\n" +
      "- Leave a slot unassigned (instructorId: null) rather than break a hard rule " +
      "— always call this out in the summary so the studio owner knows to cover it.\n\n" +
      "Always respond by calling the propose_schedule tool.",
    tools: [SCHEDULE_TOOL],
    tool_choice: { type: "tool", name: "propose_schedule" },
    messages: [
      {
        role: "user",
        content:
          `Scheduling period starting: ${periodStart}\n\n` +
          `Instructors:\n${JSON.stringify(instructorData, null, 2)}\n\n` +
          `Required weekly class slots:\n${JSON.stringify(requirementData, null, 2)}`,
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
    assignments: ScheduleAssignment[];
    summary: string;
  };

  return result;
}
