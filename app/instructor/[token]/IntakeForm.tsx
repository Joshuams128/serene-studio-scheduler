"use client";

import { useState } from "react";
import type { AvailabilitySubmission, AvailabilitySlot } from "@/lib/types";
import { DAYS, DAY_LABELS, monthLabel, type Day } from "@/lib/period";
import SiteHeader from "@/components/SiteHeader";
import {
  Button,
  Card,
  Input,
  Logo,
  Note,
  SectionHeader,
  Textarea,
} from "@/components/ui";

type Range = { start: string; end: string };
const DEFAULT_RANGE: Range = { start: "09:00", end: "12:00" };

/** Flat slot list from the database → one bucket of time ranges per weekday. */
function toDayMap(slots: AvailabilitySlot[]): Record<Day, Range[]> {
  const map = Object.fromEntries(DAYS.map((d) => [d, [] as Range[]])) as Record<
    Day,
    Range[]
  >;
  for (const slot of slots) {
    if (map[slot.day]) {
      map[slot.day].push({
        start: slot.start.slice(0, 5),
        end: slot.end.slice(0, 5),
      });
    }
  }
  return map;
}

export default function IntakeForm({
  token,
  periodStart,
  name,
  formatsTaught,
  studioFormats,
  existing,
}: {
  token: string;
  periodStart: string;
  name: string;
  formatsTaught: string[];
  studioFormats: string[];
  existing: AvailabilitySubmission | null;
}) {
  const [days, setDays] = useState<Record<Day, Range[]>>(
    toDayMap(existing?.available_slots ?? [])
  );
  const [formats, setFormats] = useState<string[]>(formatsTaught);
  const [customFormat, setCustomFormat] = useState("");
  const [preferences, setPreferences] = useState(existing?.preferences ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">(
    "idle"
  );
  const [error, setError] = useState("");

  // Studio classes plus anything this instructor already had on file.
  const formatOptions = [...new Set([...studioFormats, ...formats])].sort();

  function setRanges(day: Day, ranges: Range[]) {
    setDays((prev) => ({ ...prev, [day]: ranges }));
  }

  function toggleDay(day: Day) {
    setRanges(day, days[day].length > 0 ? [] : [{ ...DEFAULT_RANGE }]);
  }

  function toggleFormat(format: string) {
    setFormats((prev) =>
      prev.includes(format) ? prev.filter((f) => f !== format) : [...prev, format]
    );
  }

  function addCustomFormat() {
    const value = customFormat.trim();
    if (!value) return;
    if (!formats.includes(value)) setFormats((prev) => [...prev, value]);
    setCustomFormat("");
  }

  const totalRanges = DAYS.reduce((n, d) => n + days[d].length, 0);

  async function submit() {
    setStatus("saving");
    setError("");

    const availableSlots: AvailabilitySlot[] = DAYS.flatMap((day) =>
      days[day].map((r) => ({ day, start: r.start, end: r.end }))
    );

    const res = await fetch("/api/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        periodStart,
        availableSlots,
        preferences,
        formatsTaught: formats,
      }),
    });

    if (res.ok) {
      setStatus("done");
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(data.error ?? "Something went wrong — please try again.");
    setStatus("error");
  }

  /* --- Thank-you state --------------------------------------------------- */

  if (status === "done") {
    return (
      <>
        <SiteHeader href={null} subtitle="Availability" />
        <main className="mx-auto max-w-xl px-4 py-20 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-mist/30 text-3xl text-fern">
            ✓
          </div>
          <h1 className="mt-6 text-3xl font-light tracking-tight text-ink">
            Thanks, {name.split(" ")[0]}
          </h1>
          <p className="mt-3 text-base font-light leading-relaxed text-fern">
            Your availability for {monthLabel(periodStart)} is in. The studio
            will build the schedule and let you know once it&apos;s set.
          </p>
          <Button
            variant="secondary"
            className="mt-8"
            onClick={() => setStatus("idle")}
          >
            Change my answers
          </Button>
        </main>
      </>
    );
  }

  /* --- Form -------------------------------------------------------------- */

  return (
    <>
      <SiteHeader href={null} subtitle="Availability" />

      <div className="bg-[radial-gradient(120%_140%_at_50%_-40%,#FEFAE0_0%,#FAF8F3_60%)]">
        <div className="mx-auto max-w-2xl px-4 py-12 text-center sm:px-6">
          <Logo size={64} withWordmark={false} />
          <p className="eyebrow mt-5 text-sand">{monthLabel(periodStart)}</p>
          <h1 className="mt-2 text-3xl font-light tracking-tight text-ink md:text-4xl">
            Hi {name.split(" ")[0]}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-base font-light leading-relaxed text-fern">
            Tell us when you can teach next month and anything we should keep in
            mind. It takes about a minute — you can come back and change it any
            time before the schedule goes out.
          </p>
        </div>
      </div>

      <main className="mx-auto max-w-2xl space-y-6 px-4 pb-16 sm:px-6">
        {existing && (
          <Note tone="sage">
            You already sent availability for {monthLabel(periodStart)} — this
            form is pre-filled with it. Submitting again replaces it.
          </Note>
        )}

        {/* --- What they teach --- */}
        <Card>
          <SectionHeader
            title="What do you teach?"
            description="Tap everything you're comfortable covering."
          />
          <div className="px-6 py-5">
            <div className="flex flex-wrap gap-2">
              {formatOptions.map((format) => {
                const on = formats.includes(format);
                return (
                  <button
                    key={format}
                    type="button"
                    onClick={() => toggleFormat(format)}
                    aria-pressed={on}
                    className={`rounded-full border px-4 py-2 text-sm transition-all duration-200 ${
                      on
                        ? "border-clay bg-clay text-shell shadow-sm"
                        : "border-mist bg-white text-fern hover:border-sage hover:text-ink"
                    }`}
                  >
                    {format}
                  </button>
                );
              })}
              {formatOptions.length === 0 && (
                <p className="text-sm font-light text-sage">
                  The studio hasn&apos;t listed its class formats yet — add
                  yours below.
                </p>
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <Input
                value={customFormat}
                onChange={(e) => setCustomFormat(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomFormat();
                  }
                }}
                placeholder="Something else you teach"
              />
              <Button
                variant="secondary"
                onClick={addCustomFormat}
                disabled={!customFormat.trim()}
              >
                Add
              </Button>
            </div>
          </div>
        </Card>

        {/* --- Availability --- */}
        <Card>
          <SectionHeader
            title="When are you free?"
            description="Turn on the days you can teach and set the hours you're around. These apply to every week of the month — note any one-off dates at the bottom."
          />
          <div className="divide-y divide-mist/30">
            {DAYS.map((day) => {
              const ranges = days[day];
              const on = ranges.length > 0;

              return (
                <div key={day} className="px-6 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <span
                      className={`text-sm font-medium transition-colors ${
                        on ? "text-ink" : "text-sage"
                      }`}
                    >
                      {DAY_LABELS[day]}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={on}
                      aria-label={`Available on ${DAY_LABELS[day]}`}
                      onClick={() => toggleDay(day)}
                      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${
                        on ? "bg-sage" : "bg-mist/60"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                          on ? "translate-x-[1.375rem]" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </div>

                  {on && (
                    <div className="mt-3 space-y-2">
                      {ranges.map((range, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <Input
                            type="time"
                            value={range.start}
                            onChange={(e) =>
                              setRanges(
                                day,
                                ranges.map((r, idx) =>
                                  idx === i ? { ...r, start: e.target.value } : r
                                )
                              )
                            }
                            className="w-32 py-2"
                            aria-label={`${DAY_LABELS[day]} start time`}
                          />
                          <span className="text-sm font-light text-sage">to</span>
                          <Input
                            type="time"
                            value={range.end}
                            onChange={(e) =>
                              setRanges(
                                day,
                                ranges.map((r, idx) =>
                                  idx === i ? { ...r, end: e.target.value } : r
                                )
                              )
                            }
                            className="w-32 py-2"
                            aria-label={`${DAY_LABELS[day]} end time`}
                          />
                          {ranges.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setRanges(
                                  day,
                                  ranges.filter((_, idx) => idx !== i)
                                )
                              }
                              aria-label="Remove this time range"
                              className="rounded-md px-2 py-1 text-sage transition-colors hover:text-[#a4442c]"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          setRanges(day, [...ranges, { ...DEFAULT_RANGE }])
                        }
                        className="text-sm font-medium text-clay transition-opacity hover:opacity-70"
                      >
                        + Add another window
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* --- Preferences --- */}
        <Card>
          <SectionHeader
            title="Anything else we should know?"
            description="Preferences and time off both go here — it's read alongside your availability when the schedule is drafted."
          />
          <div className="px-6 py-5">
            <Textarea
              rows={4}
              placeholder="e.g. I'd rather not do back-to-back classes, mornings suit me best, and I'm away the last week of the month."
              value={preferences}
              onChange={(e) => setPreferences(e.target.value)}
            />
          </div>
        </Card>

        {error && <Note tone="alert">{error}</Note>}

        <div className="flex flex-wrap items-center gap-4">
          <Button
            variant="primary"
            size="lg"
            onClick={submit}
            disabled={status === "saving" || totalRanges === 0}
          >
            {status === "saving" ? "Sending…" : "Submit my availability"}
          </Button>
          {totalRanges === 0 && (
            <span className="text-sm font-light text-sage">
              Turn on at least one day first.
            </span>
          )}
        </div>
      </main>
    </>
  );
}
