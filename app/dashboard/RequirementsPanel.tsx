"use client";

import { useState } from "react";
import type { ClassRequirement } from "@/lib/types";
import { DAYS, DAY_LABELS, formatTime, type Day } from "@/lib/period";
import {
  Button,
  Card,
  Empty,
  Field,
  Input,
  SectionHeader,
  Select,
} from "@/components/ui";

/**
 * The studio's repeating weekly timetable — "Reformer, Mondays 9am". The
 * generator repeats this across every week of the chosen month.
 */
export default function RequirementsPanel({
  requirements,
  onChange,
}: {
  requirements: ClassRequirement[];
  onChange: (next: ClassRequirement[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [day, setDay] = useState<Day>("Mon");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [format, setFormat] = useState("");
  const [room, setRoom] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function addRequirement() {
    if (!format.trim()) return;
    setSaving(true);
    setError("");
    const res = await fetch("/api/requirements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dayOfWeek: day,
        startTime: start,
        endTime: end,
        format: format.trim(),
        room: room.trim(),
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) return setError(data.error ?? "Couldn't add that class.");
    onChange([...requirements, data.requirement]);
    setFormat("");
    setRoom("");
  }

  async function removeRequirement(id: string) {
    const res = await fetch(`/api/requirements?id=${id}`, { method: "DELETE" });
    if (res.ok) onChange(requirements.filter((r) => r.id !== id));
  }

  const byDay = DAYS.map((d) => ({
    day: d,
    classes: requirements
      .filter((r) => r.day_of_week === d)
      .sort((a, b) => a.start_time.localeCompare(b.start_time)),
  })).filter((group) => group.classes.length > 0);

  return (
    <Card>
      <SectionHeader
        eyebrow="Step 2"
        title="Weekly class template"
        description="The classes you run every week. This is the timetable the draft fills in — set it once and it carries month to month."
        action={
          !adding && (
            <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
              + Add class
            </Button>
          )
        }
      />

      <div className="divide-y divide-mist/30">
        {byDay.map(({ day: d, classes }) => (
          <div key={d} className="px-6 py-4">
            <p className="eyebrow mb-2.5 text-sage">{DAY_LABELS[d]}</p>
            <div className="space-y-1.5">
              {classes.map((r) => (
                <div
                  key={r.id}
                  className="group flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-paper"
                >
                  <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
                    <span className="w-40 shrink-0 text-sm tabular-nums text-fern">
                      {formatTime(r.start_time)} – {formatTime(r.end_time)}
                    </span>
                    <span className="text-sm font-medium text-ink">{r.format}</span>
                    {r.room && (
                      <span className="text-xs text-sage">{r.room}</span>
                    )}
                  </div>
                  <button
                    onClick={() => removeRequirement(r.id)}
                    aria-label={`Remove ${r.format} on ${DAY_LABELS[d]}`}
                    className="shrink-0 rounded-md px-1.5 text-sage opacity-0 transition-opacity hover:text-[#a4442c] focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}

        {requirements.length === 0 && !adding && (
          <Empty>
            No classes on the timetable yet — add the ones you run each week.
          </Empty>
        )}

        {adding && (
          <div className="bg-paper/60 px-6 py-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Day">
                <Select
                  value={day}
                  onChange={(e) => setDay(e.target.value as Day)}
                >
                  {DAYS.map((d) => (
                    <option key={d} value={d}>
                      {DAY_LABELS[d]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Class format">
                <Input
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  placeholder="Reformer"
                  autoFocus
                />
              </Field>
              <Field label="Starts">
                <Input
                  type="time"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </Field>
              <Field label="Ends">
                <Input
                  type="time"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </Field>
              <Field label="Room" hint="Optional." className="sm:col-span-2">
                <Input
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  placeholder="Studio A"
                />
              </Field>
            </div>
            {error && <p className="mt-3 text-sm text-[#a4442c]">{error}</p>}
            <div className="mt-4 flex gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={addRequirement}
                disabled={saving || !format.trim()}
              >
                {saving ? "Adding…" : "Add to timetable"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAdding(false);
                  setError("");
                }}
              >
                Done
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
