"use client";

import { useState } from "react";
import type { ClassRequirement } from "@/lib/types";
import { DAYS, DAY_LABELS, formatTime, type Day } from "@/lib/period";
import { firstWindow, type StudioHours } from "@/lib/studio";
import {
  CATEGORIES,
  CATEGORY_HINT,
  CATEGORY_LABEL,
  CATEGORY_PLURAL,
  DEFAULT_CATEGORY,
  toCategory,
  type Category,
  type CategoryFilter,
} from "@/lib/categories";
import {
  Badge,
  Button,
  CategoryTabs,
  Empty,
  Field,
  Input,
  Select,
} from "@/components/ui";
import CollapsibleCard from "@/components/Collapsible";

/** "06:30" + 60 -> "07:30" */
function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = (h * 60 + m + minutes) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(
    total % 60
  ).padStart(2, "0")}`;
}

/**
 * The studio's repeating weekly timetable — "Reformer, Mondays 9am". The
 * generator repeats this across every week of the chosen month.
 */
export default function RequirementsPanel({
  requirements,
  studioHours,
  onChange,
}: {
  requirements: ClassRequirement[];
  studioHours: StudioHours;
  onChange: (next: ClassRequirement[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<CategoryFilter>("all");
  const [category, setCategory] = useState<Category>(DEFAULT_CATEGORY);
  const [day, setDay] = useState<Day>("Mon");
  const [start, setStart] = useState(firstWindow(studioHours, "Mon").start);
  const [end, setEnd] = useState(addMinutes(firstWindow(studioHours, "Mon").start, 60));
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
        category,
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

  function startEditing(r: ClassRequirement) {
    setAdding(false);
    setEditingId(r.id);
    setCategory(toCategory(r.category));
    setDay(r.day_of_week as Day);
    setStart(r.start_time.slice(0, 5));
    setEnd(r.end_time.slice(0, 5));
    setFormat(r.format);
    setRoom(r.room ?? "");
    setError("");
  }

  function stopEditing() {
    setEditingId(null);
    setError("");
  }

  async function saveEdit() {
    if (!editingId || !format.trim()) return;
    setSaving(true);
    setError("");
    const res = await fetch("/api/requirements", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingId,
        dayOfWeek: day,
        startTime: start,
        endTime: end,
        format: format.trim(),
        category,
        room: room.trim(),
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) return setError(data.error ?? "Couldn't save that change.");
    onChange(
      requirements.map((r) => (r.id === editingId ? data.requirement : r))
    );
    setEditingId(null);
    setFormat("");
    setRoom("");
  }

  async function removeRequirement(id: string) {
    const res = await fetch(`/api/requirements?id=${id}`, { method: "DELETE" });
    if (res.ok) onChange(requirements.filter((r) => r.id !== id));
  }

  const counts: Record<CategoryFilter, number> = {
    all: requirements.length,
    class: requirements.filter((r) => toCategory(r.category) === "class").length,
    shift: requirements.filter((r) => toCategory(r.category) === "shift").length,
  };

  const visible = requirements.filter(
    (r) => filter === "all" || toCategory(r.category) === filter
  );

  const byDay = DAYS.map((d) => ({
    day: d,
    classes: visible
      .filter((r) => r.day_of_week === d)
      .sort((a, b) => a.start_time.localeCompare(b.start_time)),
  })).filter((group) => group.classes.length > 0);

  return (
    <CollapsibleCard
      id="template"
      eyebrow="Step 2"
      title="Weekly template"
      description="The classes and shifts you run every week. This is the timetable the draft fills in — set it once and it carries month to month."
      summary={
        counts.all === 0
          ? "Nothing set up yet"
          : `${counts.all} entries · ${counts.class} ${
              counts.class === 1 ? "class" : "classes"
            } · ${counts.shift} ${counts.shift === 1 ? "shift" : "shifts"}`
      }
      // Set once and then mostly scrolled past — start folded once it has
      // something in it.
      defaultOpen={requirements.length === 0}
      action={
        !adding &&
        !editingId && (
          <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
            + Add entry
          </Button>
        )
      }
    >

      {counts.all > 0 && (
        <div className="border-b border-mist/40 px-6 py-3">
          <CategoryTabs value={filter} onChange={setFilter} counts={counts} />
        </div>
      )}

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
                    <span className="w-full shrink-0 text-sm tabular-nums text-fern sm:w-40">
                      {formatTime(r.start_time)} – {formatTime(r.end_time)}
                    </span>
                    <span className="text-sm font-medium text-ink">{r.format}</span>
                    {r.room && (
                      <span className="text-xs text-sage">{r.room}</span>
                    )}
                    {filter === "all" && toCategory(r.category) !== "class" && (
                      <Badge tone="clay">{CATEGORY_LABEL[toCategory(r.category)]}</Badge>
                    )}
                  </div>
                  <span className="flex shrink-0 items-center">
                  <button
                    onClick={() => startEditing(r)}
                    aria-label={`Edit ${r.format} on ${DAY_LABELS[d]}`}
                    className="flex h-9 items-center justify-center rounded-md px-2 text-sm font-medium text-clay transition-opacity hover:opacity-70 sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => removeRequirement(r.id)}
                    aria-label={`Remove ${r.format} on ${DAY_LABELS[d]}`}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-sage transition-opacity hover:text-[#a4442c] focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    ✕
                  </button>
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {visible.length === 0 && !adding && !editingId && (
          <Empty>
            {counts.all === 0
              ? "Nothing on the timetable yet — add the classes and shifts you run each week."
              : `No ${CATEGORY_PLURAL[filter as Category].toLowerCase()} on the timetable yet.`}
          </Empty>
        )}

        {(adding || editingId) && (
          <div className="bg-paper/60 px-6 py-5">
            {editingId && (
              <p className="eyebrow mb-3 text-sage">Editing this entry</p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Kind"
                hint={CATEGORY_HINT[category]}
                className="sm:col-span-2"
              >
                <Select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as Category)}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Day">
                <Select
                  value={day}
                  onChange={(e) => {
                    const next = e.target.value as Day;
                    setDay(next);
                    // Reseed from that day's opening time in case it differs.
                    const open = firstWindow(studioHours, next).start;
                    setStart(open);
                    setEnd(addMinutes(open, 60));
                  }}
                >
                  {DAYS.map((d) => (
                    <option key={d} value={d}>
                      {DAY_LABELS[d]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={category === "shift" ? "Shift type" : "Class format"}>
                <Input
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  placeholder={category === "shift" ? "Concierge" : "Reformer"}
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
                onClick={editingId ? saveEdit : addRequirement}
                disabled={saving || !format.trim()}
              >
                {saving
                  ? "Saving…"
                  : editingId
                    ? "Save changes"
                    : "Add to timetable"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (editingId) stopEditing();
                  else setAdding(false);
                  setError("");
                }}
              >
                {editingId ? "Cancel" : "Done"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </CollapsibleCard>
  );
}
