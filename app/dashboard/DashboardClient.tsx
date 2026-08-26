"use client";

import { useState, useTransition } from "react";
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
import { Button, Card, Note, SectionHeader } from "@/components/ui";
import InstructorsPanel from "./InstructorsPanel";
import RequirementsPanel from "./RequirementsPanel";

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
      <SiteHeader href={null} right={<LogoutButton />} />

      {/* --- Period band ---------------------------------------------- */}
      <div className="border-b border-mist/30 bg-[radial-gradient(120%_140%_at_20%_-40%,#FEFAE0_0%,#FAF8F3_60%)]">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="eyebrow text-sand">Monthly schedule</p>
              <div className="mt-1.5 flex items-center gap-3">
                <button
                  onClick={() => goToMonth(-1)}
                  disabled={navigating}
                  aria-label={`Go to ${monthLabelShort(addMonths(periodStart, -1))}`}
                  className="rounded-lg px-2 py-1 text-2xl leading-none text-mist transition-colors hover:text-fern disabled:opacity-40"
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
                  className="rounded-lg px-2 py-1 text-2xl leading-none text-mist transition-colors hover:text-fern disabled:opacity-40"
                >
                  ›
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6">
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
          <InstructorsPanel
            periodStart={periodStart}
            instructors={instructors}
            submissions={submissions}
            onChange={setInstructors}
          />
          <RequirementsPanel
            requirements={requirements}
            onChange={setRequirements}
          />
        </div>

        <Card>
          <SectionHeader
            eyebrow="Step 3"
            title={`Draft for ${monthLabel(periodStart)}`}
            description="Every class in the month with an instructor pencilled in. Change anyone you like, then approve — or delete the draft and start again."
          />
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
        </Card>
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:px-8">
        <p className="border-t border-mist/40 pt-6 text-xs font-light text-sage">
          Serene Pilates · Studio Scheduler
        </p>
      </footer>
    </>
  );
}
