"use client";

import { useMemo, useState } from "react";
import type { AvailabilitySubmission, AvailabilitySlot } from "@/lib/types";
import { isPerWeek } from "@/lib/types";
import {
  DAYS,
  DAY_LABELS,
  dayOfDate,
  formatDateShort,
  monthLabel,
  weeksInMonth,
  type Day,
} from "@/lib/period";
import { STUDIO_HOURS, studioHoursLabel } from "@/lib/studio";
import SiteHeader from "@/components/SiteHeader";
import {
  Badge,
  Button,
  Card,
  Input,
  Logo,
  Note,
  SectionHeader,
  Textarea,
} from "@/components/ui";

type Range = { start: string; end: string };
type DayMap = Record<Day, Range[]>;

/** Turning a day on offers the studio's full opening hours for it. */
function studioRanges(day: Day): Range[] {
  return STUDIO_HOURS[day].map((w) => ({ ...w }));
}

/** Every day of the week, filled with the studio's open hours. */
function fullStudioWeek(days: Day[]): DayMap {
  const map = emptyDayMap();
  for (const day of days) map[day] = studioRanges(day);
  return map;
}

function emptyDayMap(): DayMap {
  return Object.fromEntries(DAYS.map((d) => [d, [] as Range[]])) as DayMap;
}

function cloneDayMap(map: DayMap): DayMap {
  return Object.fromEntries(
    DAYS.map((d) => [d, map[d].map((r) => ({ ...r }))])
  ) as DayMap;
}

function countRanges(map: DayMap): number {
  return DAYS.reduce((n, d) => n + map[d].length, 0);
}

/** Slots for one week (or the repeating pattern) → per-weekday buckets. */
function toDayMap(slots: AvailabilitySlot[]): DayMap {
  const map = emptyDayMap();
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

/* ---------------------------------------------------------------------------
   One week's (or the repeating pattern's) seven day rows.
--------------------------------------------------------------------------- */

function DayScheduleEditor({
  value,
  onChange,
  days,
  dateFor,
}: {
  value: DayMap;
  onChange: (next: DayMap) => void;
  /** Which weekdays to show — a partial week doesn't have all seven. */
  days: Day[];
  /** Optional real date to show beside each day, in per-week mode. */
  dateFor?: (day: Day) => string | undefined;
}) {
  function setRanges(day: Day, ranges: Range[]) {
    onChange({ ...value, [day]: ranges });
  }

  return (
    <div className="divide-y divide-mist/30">
      {days.map((day) => {
        const ranges = value[day];
        const on = ranges.length > 0;
        const date = dateFor?.(day);

        return (
          <div key={day} className="px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <span
                className={`text-sm font-medium transition-colors ${
                  on ? "text-ink" : "text-sage"
                }`}
              >
                {DAY_LABELS[day]}
                {date && (
                  <span className="ml-2 text-xs font-light text-sage">
                    {date}
                  </span>
                )}
                <span className="mt-0.5 block text-xs font-light text-sage">
                  Studio open {studioHoursLabel(day)}
                </span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={`Available on ${DAY_LABELS[day]}${date ? ` ${date}` : ""}`}
                onClick={() => setRanges(day, on ? [] : studioRanges(day))}
                className="-m-2 flex h-10 shrink-0 items-center justify-center p-2"
              >
                <span
                  className={`relative block h-6 w-11 rounded-full transition-colors duration-200 ${
                    on ? "bg-sage" : "bg-mist/60"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                      on ? "translate-x-[1.375rem]" : "translate-x-0.5"
                    }`}
                  />
                </span>
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
                          setRanges(day, ranges.filter((_, idx) => idx !== i))
                        }
                        aria-label="Remove this time range"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-sage transition-colors hover:text-[#a4442c]"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setRanges(day, [...ranges, { ...STUDIO_HOURS[day][0] }])
                  }
                  className="py-2 text-sm font-medium text-clay transition-opacity hover:opacity-70"
                >
                  + Add another window
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------------- */

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
  const weeks = useMemo(() => weeksInMonth(periodStart), [periodStart]);

  const existingSlots = existing?.available_slots ?? [];
  const startedPerWeek = isPerWeek(existingSlots);

  // Two independent drafts, so ticking the box back and forth never destroys
  // work: the repeating pattern and the per-week one both stay in state.
  const [repeatsWeekly, setRepeatsWeekly] = useState(!startedPerWeek);
  const [weekly, setWeekly] = useState<DayMap>(() =>
    startedPerWeek ? emptyDayMap() : toDayMap(existingSlots)
  );
  const [byWeek, setByWeek] = useState<DayMap[]>(() =>
    weeks.map((_, i) =>
      startedPerWeek
        ? toDayMap(existingSlots.filter((s) => s.week === i + 1))
        : emptyDayMap()
    )
  );
  const [activeWeek, setActiveWeek] = useState(0);

  const [formats, setFormats] = useState<string[]>(formatsTaught);
  const [customFormat, setCustomFormat] = useState("");
  const [preferences, setPreferences] = useState(existing?.preferences ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">(
    "idle"
  );
  const [error, setError] = useState("");

  const formatOptions = [...new Set([...studioFormats, ...formats])].sort();

  /** Switching to per-week seeds every week from the repeating pattern, so
   *  they only have to change the week that's actually different. */
  function setMode(weekly_: boolean) {
    if (!weekly_ && byWeek.every((w) => countRanges(w) === 0)) {
      setByWeek(weeks.map(() => cloneDayMap(weekly)));
    }
    setRepeatsWeekly(weekly_);
  }

  function copyWeekToAll(from: number) {
    setByWeek((prev) => prev.map(() => cloneDayMap(prev[from])));
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

  const totalRanges = repeatsWeekly
    ? countRanges(weekly)
    : byWeek.reduce((n, w) => n + countRanges(w), 0);

  async function submit() {
    setStatus("saving");
    setError("");

    const availableSlots: AvailabilitySlot[] = repeatsWeekly
      ? DAYS.flatMap((day) =>
          weekly[day].map((r) => ({ day, start: r.start, end: r.end }))
        )
      : byWeek.flatMap((map, i) =>
          DAYS.flatMap((day) =>
            map[day].map((r) => ({
              day,
              start: r.start,
              end: r.end,
              week: i + 1,
            }))
          )
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

  const week = weeks[activeWeek];
  const weekDays = week ? [...new Set(week.dates.map(dayOfDate))] : DAYS.slice();

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
                    className={`min-h-[2.5rem] rounded-full border px-4 py-2 text-sm transition-all duration-200 ${
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
            description="Turn on the days you can teach and set the hours you're around."
          />

          {/* The shortcut: most people keep the same days all month. */}
          <label className="flex cursor-pointer items-start gap-3 border-b border-mist/40 bg-paper/60 px-6 py-4">
            <input
              type="checkbox"
              checked={repeatsWeekly}
              onChange={(e) => setMode(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-mist accent-[#BC6C24]"
            />
            <span>
              <span className="block text-sm font-medium text-ink">
                My days are the same every week
              </span>
              <span className="mt-0.5 block text-xs font-light leading-relaxed text-fern">
                Fill it in once and we&apos;ll use it for all{" "}
                {weeks.length} weeks of {monthLabel(periodStart)}. Untick if some
                weeks are different.
              </span>
            </span>
          </label>

          {repeatsWeekly ? (
            <>
              <div className="flex justify-end px-6 pt-4">
                <button
                  type="button"
                  onClick={() => setWeekly(fullStudioWeek(DAYS.slice()))}
                  className="py-2 text-sm font-medium text-clay transition-opacity hover:opacity-70"
                >
                  I&apos;m free whenever the studio is open
                </button>
              </div>
              <DayScheduleEditor
                value={weekly}
                onChange={setWeekly}
                days={DAYS.slice()}
              />
            </>
          ) : (
            <>
              {/* Week picker — the count shows which weeks still need filling. */}
              <div className="flex gap-2 overflow-x-auto border-b border-mist/40 px-6 py-4">
                {weeks.map((w, i) => {
                  const filled = countRanges(byWeek[i]);
                  const active = i === activeWeek;
                  return (
                    <button
                      key={w.index}
                      type="button"
                      onClick={() => setActiveWeek(i)}
                      aria-current={active}
                      className={`shrink-0 rounded-xl border px-3.5 py-2 text-left transition-all duration-200 ${
                        active
                          ? "border-clay bg-clay/8 text-ink"
                          : "border-mist/60 bg-white text-fern hover:border-sage"
                      }`}
                    >
                      <span className="block text-sm font-medium">
                        Week {i + 1}
                      </span>
                      <span className="mt-0.5 block text-xs font-light text-sage">
                        {formatDateShort(w.dates[0])}–
                        {formatDateShort(w.dates[w.dates.length - 1])}
                      </span>
                      <span
                        className={`mt-1 block text-[0.6875rem] font-medium ${
                          filled > 0 ? "text-sage" : "text-sand"
                        }`}
                      >
                        {filled > 0 ? `${filled} window${filled === 1 ? "" : "s"}` : "Not set"}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-6 pt-4">
                <Badge tone="mist">
                  Editing week {activeWeek + 1} of {weeks.length}
                </Badge>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <button
                    type="button"
                    onClick={() =>
                      setByWeek((prev) =>
                        prev.map((w, i) =>
                          i === activeWeek ? fullStudioWeek(weekDays) : w
                        )
                      )
                    }
                    className="py-1.5 text-sm font-medium text-clay transition-opacity hover:opacity-70"
                  >
                    Free all open hours
                  </button>
                  <button
                    type="button"
                    onClick={() => copyWeekToAll(activeWeek)}
                    className="py-1.5 text-sm font-medium text-clay transition-opacity hover:opacity-70"
                  >
                    Copy to all {weeks.length} weeks
                  </button>
                </div>
              </div>

              <DayScheduleEditor
                value={byWeek[activeWeek]}
                onChange={(next) =>
                  setByWeek((prev) =>
                    prev.map((w, i) => (i === activeWeek ? next : w))
                  )
                }
                days={weekDays}
                dateFor={(day) => {
                  const date = week?.dates.find((d) => dayOfDate(d) === day);
                  return date ? formatDateShort(date) : undefined;
                }}
              />
            </>
          )}
        </Card>

        {/* --- Preferences --- */}
        <Card>
          <SectionHeader
            title="Anything else we should know?"
            description="Preferences go here — it's read alongside your availability when the schedule is drafted."
          />
          <div className="px-6 py-5">
            <Textarea
              rows={4}
              placeholder="e.g. I'd rather not do back-to-back classes, and mornings suit me best."
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
