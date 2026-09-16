"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  AvailabilitySubmission,
  ClassRequirement,
  Instructor,
  Schedule,
} from "@/lib/types";
import { addMonths, monthLabel, monthLabelShort } from "@/lib/period";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/LogoutButton";
import ScheduleGrid from "@/components/ScheduleGrid";
import Tour, { TourButton, hasSeenTour, type TourStep } from "@/components/Tour";
import { Button, Note } from "@/components/ui";
import CollapsibleCard from "@/components/Collapsible";
import InstructorsPanel from "./InstructorsPanel";
import RequirementsPanel from "./RequirementsPanel";

const TOUR_STEPS: TourStep[] = [
  {
    title: "Welcome to your scheduler",
    body: "This builds next month's class schedule for you from your instructors' availability, so you're tweaking a draft instead of starting from a blank calendar. Here's the quick tour — about a minute.",
  },
  {
    target: "tour-period",
    title: "You're planning one month at a time",
    body: "It opens on the month you're about to build. Use the ‹ and › arrows to look back at a month that's already running, or jump further ahead.",
  },
  {
    target: "tour-team",
    title: "Step 1 — your team",
    body: "Everyone who covers anything lives here — teaching, front desk, or both. Add them, then hit “Copy link” and send their private link by text or email. No passwords for them. Use the Classes / Shifts tabs to see who covers what, and “View” to read what someone sent.",
  },
  {
    target: "tour-template",
    title: "Step 2 — what you run each week",
    body: "Set your usual weekly timetable once — Reformer on Mondays at 7, concierge cover on Saturdays, and so on. Each entry is either a Class or a Shift, and the tabs let you work on one at a time. It carries over month to month, so this is a one-time job.",
  },
  {
    target: "tour-draft",
    title: "Step 3 — draft the schedule",
    body: "Once a couple of people have replied, press this. It spreads your weekly template across every date in the month and picks who covers each class and shift, matching everyone's availability, what they cover, and their requests.",
  },
  {
    target: "tour-schedule",
    title: "Then change whatever you like",
    body: "Every entry gets a dropdown, so swapping someone is one click. Filter to Classes or Shifts to work through one at a time — the draft underneath always covers everything, so nobody gets double-booked between a class and a shift. The counts show each person's total across both.",
  },
  {
    target: "tour-schedule",
    title: "Save, approve, or start over",
    body: "“Save changes” keeps your edits, “Approve schedule” marks it final. Not happy with it? “Delete draft” clears the month completely, or “Re-draft schedule” up top just tries again.",
  },
  {
    target: "tour-schedule",
    title: "Then email it to everyone",
    body: "Down at the bottom, “Send to instructors” emails the month out — each person gets their own list at the top and only the parts of the month that apply to them below, so someone who only covers front desk isn't sent the class timetable. Preview it first if you like.",
  },
  {
    title: "That's everything",
    body: "Need this again? The ? button in the top corner replays the tour any time.",
  },
];

/** localStorage has no change events worth wiring up here. */
function subscribeNothing() {
  return () => {};
}

export default function DashboardClient({
  periodStart,
  initialInstructors,
  initialRequirements,
  initialSubmissions,
  initialSchedule,
}: {
  periodStart: string;
  initialInstructors: Instructor[];
  initialRequirements: ClassRequirement[];
  initialSubmissions: AvailabilitySubmission[];
  initialSchedule: Schedule | null;
}) {
  const router = useRouter();
  const [navigating, startNavigating] = useTransition();

  const [instructors, setInstructors] = useState(initialInstructors);
  const [requirements, setRequirements] = useState(initialRequirements);
  const [submissions] = useState(initialSubmissions);
  const [schedule, setSchedule] = useState(initialSchedule);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  // Whether to run the tour unprompted. Read through useSyncExternalStore so
  // the server renders "no tour" and the client decides on hydration — reading
  // localStorage during render would mismatch, and doing it in an effect would
  // mean an extra render pass.
  const autoRun = useSyncExternalStore(
    subscribeNothing,
    () => !hasSeenTour(),
    () => false
  );
  // null = follow autoRun; true/false = the owner opened or closed it by hand.
  const [tourOverride, setTourOverride] = useState<boolean | null>(null);
  const tourOpen = tourOverride ?? autoRun;

  function goToMonth(offset: number) {
    startNavigating(() => {
      router.push(`/dashboard?period=${addMonths(periodStart, offset)}`);
    });
  }

  async function generate() {
    setGenerating(true);
    setGenError("");
    const res = await fetch("/api/generate-schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodStart }),
    });
    const data = await res.json();
    setGenerating(false);
    if (!res.ok) return setGenError(data.error ?? "Something went wrong.");
    setSchedule(data.schedule);
  }

  const submitted = submissions.length;
  const total = instructors.length;
  const pct = total === 0 ? 0 : Math.round((submitted / total) * 100);
  const canGenerate = requirements.length > 0 && submitted > 0;

  return (
    <>
      <SiteHeader
        href={null}
        right={
          <>
            <TourButton onClick={() => setTourOverride(true)} />
            <LogoutButton />
          </>
        }
      />

      {/* --- Period band ---------------------------------------------- */}
      <div className="border-b border-mist/30 bg-[radial-gradient(120%_140%_at_20%_-40%,#FEFAE0_0%,#FAF8F3_60%)]">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div id="tour-period">
              <p className="eyebrow text-sand">Monthly schedule</p>
              <div className="mt-1.5 flex items-center gap-3">
                <button
                  onClick={() => goToMonth(-1)}
                  disabled={navigating}
                  aria-label={`Go to ${monthLabelShort(addMonths(periodStart, -1))}`}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-2xl leading-none text-mist transition-colors hover:text-fern disabled:opacity-40"
                >
                  ‹
                </button>
                <h1 className="text-3xl font-light tracking-tight text-ink md:text-4xl">
                  {monthLabel(periodStart)}
                </h1>
                <button
                  onClick={() => goToMonth(1)}
                  disabled={navigating}
                  aria-label={`Go to ${monthLabelShort(addMonths(periodStart, 1))}`}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-2xl leading-none text-mist transition-colors hover:text-fern disabled:opacity-40"
                >
                  ›
                </button>
              </div>
            </div>

            <div id="tour-draft" className="flex flex-wrap items-center gap-6">
              <div className="min-w-[13rem]">
                <p className="text-sm font-light text-fern">
                  <span className="font-medium text-ink">{submitted}</span> of{" "}
                  {total} instructor{total === 1 ? "" : "s"} submitted
                </p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-mist/40">
                  <div
                    className="h-full rounded-full bg-sand transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              <Button
                variant="primary"
                size="lg"
                onClick={generate}
                disabled={generating || !canGenerate}
                title={
                  canGenerate
                    ? undefined
                    : "Add your weekly classes and collect at least one availability first"
                }
              >
                {generating
                  ? "Drafting…"
                  : schedule
                    ? "Re-draft schedule"
                    : "Draft the schedule"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-2">
          <div id="tour-team">
            <InstructorsPanel
              periodStart={periodStart}
              instructors={instructors}
              submissions={submissions}
              requirements={requirements}
              onChange={setInstructors}
            />
          </div>
          <div id="tour-template">
            <RequirementsPanel
              requirements={requirements}
              onChange={setRequirements}
            />
          </div>
        </div>

        <div id="tour-schedule">
          <CollapsibleCard
            id="draft"
            eyebrow="Step 3"
            title={`Draft for ${monthLabel(periodStart)}`}
            description="Every class and shift in the month with someone pencilled in. Change anyone you like, then approve — or delete the draft and start again."
            summary={
              schedule
                ? `${schedule.assignments.length} entries · ${
                    schedule.assignments.filter((a) => !a.instructorId).length
                  } still need cover`
                : "Nothing drafted yet"
            }
          >
          <div className="px-6 py-6">
            {genError && <Note tone="alert">{genError}</Note>}

            {schedule ? (
              <ScheduleGrid
                periodStart={periodStart}
                schedule={schedule}
                instructors={instructors}
                onSaved={setSchedule}
                onDeleted={() => {
                  setSchedule(null);
                  router.refresh();
                }}
              />
            ) : (
              !genError && (
                <div className="py-8 text-center">
                  <p className="text-lg font-light text-fern">
                    Nothing drafted for {monthLabel(periodStart)} yet.
                  </p>
                  <p className="mx-auto mt-2 max-w-md text-sm font-light leading-relaxed text-sage">
                    {requirements.length === 0
                      ? "Add your weekly classes above so there's a timetable to fill."
                      : submitted === 0
                        ? "Send your instructors their links and wait for the first availability to come in."
                        : `${submitted} availability submission${submitted === 1 ? "" : "s"} in — hit “Draft the schedule” and you'll have a full month to tweak.`}
                  </p>
                </div>
              )
            )}
          </div>
          </CollapsibleCard>
        </div>
      </main>

      {tourOpen && (
        <Tour steps={TOUR_STEPS} onClose={() => setTourOverride(false)} />
      )}

      <footer className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:px-8">
        <p className="border-t border-mist/40 pt-6 text-xs font-light text-sage">
          Serene Pilates · Studio Scheduler
        </p>
      </footer>
    </>
  );
}
