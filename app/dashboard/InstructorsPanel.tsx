"use client";

import { useState } from "react";
import type { AvailabilitySubmission, Instructor } from "@/lib/types";
import { isPerWeek } from "@/lib/types";
import { formatDateShort, formatTime, monthLabel, weeksInMonth } from "@/lib/period";
import type { ClassRequirement } from "@/lib/types";
import {
  CATEGORY_LABEL,
  CATEGORY_TEAM_LABEL,
  categoriesForFormats,
  categoryMap,
  categoryOf,
  type CategoryFilter,
} from "@/lib/categories";
import {
  Badge,
  Button,
  CategoryTabs,
  Empty,
  Field,
  Input,
} from "@/components/ui";
import CollapsibleCard from "@/components/Collapsible";

export default function InstructorsPanel({
  periodStart,
  instructors,
  submissions,
  requirements,
  onChange,
}: {
  periodStart: string;
  instructors: Instructor[];
  submissions: AvailabilitySubmission[];
  /** Only used to work out which category each format belongs to. */
  requirements: ClassRequirement[];
  onChange: (next: Instructor[]) => void;
}) {
  const [filter, setFilter] = useState<CategoryFilter>("all");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [formats, setFormats] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function addInstructor() {
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    const res = await fetch("/api/instructors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim(),
        formatsTaught: formats
          .split(",")
          .map((f) => f.trim())
          .filter(Boolean),
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) return setError(data.error ?? "Couldn't add that instructor.");
    onChange([...instructors, data.instructor]);
    setName("");
    setEmail("");
    setFormats("");
    setAdding(false);
  }

  function startEditing(i: Instructor) {
    setAdding(false);
    setEditingId(i.id);
    setName(i.name);
    setEmail(i.email ?? "");
    setFormats(i.formats_taught.join(", "));
    setError("");
  }

  async function saveEdit() {
    if (!editingId || !name.trim()) return;
    setSaving(true);
    setError("");
    const res = await fetch("/api/instructors", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingId,
        name: name.trim(),
        email: email.trim(),
        formatsTaught: formats
          .split(",")
          .map((f) => f.trim())
          .filter(Boolean),
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) return setError(data.error ?? "Couldn't save that change.");
    onChange(instructors.map((i) => (i.id === editingId ? data.instructor : i)));
    setEditingId(null);
    setName("");
    setEmail("");
    setFormats("");
  }

  async function removeInstructor(id: string, instructorName: string) {
    if (
      !window.confirm(
        `Remove ${instructorName}? Their availability submissions will be removed too.`
      )
    ) {
      return;
    }
    const res = await fetch(`/api/instructors?id=${id}`, { method: "DELETE" });
    if (res.ok) onChange(instructors.filter((i) => i.id !== id));
  }

  async function copyLink(instructor: Instructor) {
    // Carry the month being planned so the instructor's form matches whatever
    // the owner is looking at, not whatever month they happen to open it in.
    const url = `${window.location.origin}/instructor/${instructor.invite_token}?period=${periodStart}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Copy this link and send it to your instructor:", url);
      return;
    }
    setCopiedId(instructor.id);
    setTimeout(() => setCopiedId((c) => (c === instructor.id ? null : c)), 2000);
  }

  // One roster, tagged by what each person covers — never two lists.
  const formatCategories = categoryMap(requirements);
  const coversFilter = (i: Instructor) =>
    filter === "all" ||
    categoriesForFormats(formatCategories, i.formats_taught).has(filter);

  const counts: Record<CategoryFilter, number> = {
    all: instructors.length,
    class: instructors.filter((i) =>
      categoriesForFormats(formatCategories, i.formats_taught).has("class")
    ).length,
    shift: instructors.filter((i) =>
      categoriesForFormats(formatCategories, i.formats_taught).has("shift")
    ).length,
  };

  const visible = instructors.filter(coversFilter);

  const submittedCount = instructors.filter((i) =>
    submissions.some((s) => s.instructor_id === i.id)
  ).length;

  return (
    <CollapsibleCard
      id="team"
      eyebrow="Step 1"
      title="Your team"
      description="Everyone who covers anything — classes, shifts, or both. Each person gets one private link, ticks their availability once, and you see it land here."
      summary={`${instructors.length} ${
        instructors.length === 1 ? "person" : "people"
      } · ${submittedCount} submitted`}
      action={
        !adding &&
        !editingId && (
          <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
            + Add team member
          </Button>
        )
      }
    >

      {counts.all > 0 && (
        <div className="border-b border-mist/40 px-6 py-3">
          <CategoryTabs
            value={filter}
            onChange={setFilter}
            counts={counts}
            allLabel="Everyone"
          />
        </div>
      )}

      <div className="divide-y divide-mist/30">
        {visible.map((instructor) => {
          const submission = submissions.find(
            (s) => s.instructor_id === instructor.id
          );
          const isOpen = expandedId === instructor.id;

          return (
            <div key={instructor.id} className="px-6 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-ink">{instructor.name}</p>
                    {submission ? (
                      <Badge tone="sage">✓ Submitted</Badge>
                    ) : (
                      <Badge tone="sand">Waiting</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm font-light text-fern">
                    {instructor.formats_taught.length > 0
                      ? instructor.formats_taught
                          .map((f) =>
                            categoryOf(formatCategories, f) === "shift"
                              ? `${f} (${CATEGORY_LABEL.shift})`
                              : f
                          )
                          .join(" · ")
                      : "Nothing assigned yet"}
                    {!instructor.email?.trim() && (
                      <span className="text-sand"> · no email on file</span>
                    )}
                  </p>
                </div>

                <div className="flex w-full items-center gap-1 sm:w-auto sm:shrink-0">
                  {submission && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedId(isOpen ? null : instructor.id)}
                    >
                      {isOpen ? "Hide" : "View"}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => startEditing(instructor)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyLink(instructor)}
                  >
                    {copiedId === instructor.id ? "Copied ✓" : "Copy link"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[#a4442c]/70 hover:text-[#a4442c]"
                    onClick={() => removeInstructor(instructor.id, instructor.name)}
                    aria-label={`Remove ${instructor.name}`}
                  >
                    ✕
                  </Button>
                </div>
              </div>

              {isOpen && submission && (
                <div className="mt-3 rounded-xl bg-paper px-4 py-3">
                  <p className="eyebrow mb-2 text-sage">
                    Available in {monthLabel(periodStart)}
                  </p>
                  {submission.available_slots.length === 0 ? (
                    <span className="text-sm text-sage">
                      No availability given.
                    </span>
                  ) : isPerWeek(submission.available_slots) ? (
                    // Their availability changes week to week — show it that way
                    // rather than flattening it into one misleading list.
                    <div className="space-y-2">
                      {weeksInMonth(periodStart).map((week, i) => {
                        const slots = submission.available_slots.filter(
                          (s) => s.week === i + 1
                        );
                        return (
                          <div key={week.index}>
                            <p className="mb-1 text-xs font-medium text-fern">
                              Week {i + 1}
                              <span className="ml-1.5 font-light text-sage">
                                {formatDateShort(week.dates[0])}–
                                {formatDateShort(week.dates[week.dates.length - 1])}
                              </span>
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {slots.length > 0 ? (
                                slots.map((slot, j) => (
                                  <Badge key={j} tone="mist">
                                    {slot.day} {formatTime(slot.start)}–
                                    {formatTime(slot.end)}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-xs text-sand">
                                  Not available
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <>
                      <p className="mb-1.5 text-xs font-light text-sage">
                        Same every week
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {submission.available_slots.map((slot, i) => (
                          <Badge key={i} tone="mist">
                            {slot.day} {formatTime(slot.start)}–
                            {formatTime(slot.end)}
                          </Badge>
                        ))}
                      </div>
                    </>
                  )}
                  {submission.preferences && (
                    <p className="mt-3 border-t border-mist/40 pt-3 text-sm font-light italic leading-relaxed text-fern">
                      “{submission.preferences}”
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {visible.length === 0 && !adding && !editingId && (
          <Empty>
            {counts.all === 0
              ? "Nobody on the team yet — add your first person to get started."
              : `Nobody covers ${CATEGORY_TEAM_LABEL[filter as "class" | "shift"].toLowerCase()} work yet.`}
          </Empty>
        )}

        {(adding || editingId) && (
          <div className="bg-paper/60 px-6 py-5">
            {editingId && (
              <p className="eyebrow mb-3 text-sage">
                Editing — their availability is kept
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  autoFocus
                />
              </Field>
              <Field
                label="Email"
                hint="Used to send them the finished schedule."
              >
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@example.com"
                />
              </Field>
              <Field
                label="What they cover"
                hint="Classes and shifts alike, comma separated. They can correct this themselves on their link."
                className="sm:col-span-2"
              >
                <Input
                  value={formats}
                  onChange={(e) => setFormats(e.target.value)}
                  placeholder="Reformer, Mat, Concierge"
                />
              </Field>
            </div>
            {error && <p className="mt-3 text-sm text-[#a4442c]">{error}</p>}
            <div className="mt-4 flex gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={editingId ? saveEdit : addInstructor}
                disabled={saving || !name.trim()}
              >
                {saving
                  ? "Saving…"
                  : editingId
                    ? "Save changes"
                    : "Add team member"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAdding(false);
                  setEditingId(null);
                  setError("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </CollapsibleCard>
  );
}
