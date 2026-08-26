"use client";

import { useMemo, useState } from "react";
import type { Instructor, Schedule, ScheduleAssignment } from "@/lib/types";
import { assignmentKey } from "@/lib/types";
import { formatDate, formatTime, weeksInMonth } from "@/lib/period";
import { Badge, Button, Note, Select } from "@/components/ui";

export default function ScheduleGrid({
  periodStart,
  schedule,
  instructors,
  onSaved,
  onDeleted,
}: {
  periodStart: string;
  schedule: Schedule;
  instructors: Instructor[];
  onSaved: (s: Schedule) => void;
  onDeleted: () => void;
}) {
  const [assignments, setAssignments] = useState<ScheduleAssignment[]>(
    schedule.assignments
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState<"save" | "approve" | "delete" | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState("");

  // The month laid out as weeks, each holding only the classes that fall in it.
  const weeks = useMemo(() => {
    const byDate = new Map<string, ScheduleAssignment[]>();
    for (const a of assignments) {
      const list = byDate.get(a.date) ?? [];
      list.push(a);
      byDate.set(a.date, list);
    }

    return weeksInMonth(periodStart)
      .map((week) => ({
        ...week,
        classes: week.dates
          .flatMap((date) => byDate.get(date) ?? [])
          .sort((a, b) =>
            a.date === b.date
              ? a.start.localeCompare(b.start)
              : a.date.localeCompare(b.date)
          ),
      }))
      .filter((week) => week.classes.length > 0);
  }, [assignments, periodStart]);

  function assign(target: ScheduleAssignment, instructorId: string) {
    const instructor = instructors.find((i) => i.id === instructorId);
    const key = assignmentKey(target);
    setAssignments((prev) =>
      prev.map((a) =>
        assignmentKey(a) === key
          ? {
              ...a,
              instructorId: instructor?.id ?? null,
              instructorName: instructor?.name ?? null,
            }
          : a
      )
    );
    setDirty(true);
  }

  async function save(status?: "approved") {
    setSaving(status ? "approve" : "save");
    setError("");
    const res = await fetch("/api/schedule", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodStart, assignments, status }),
    });
    const data = await res.json();
    setSaving(null);
    if (!res.ok) return setError(data.error ?? "Couldn't save those changes.");
    onSaved(data.schedule);
    setDirty(false);
  }

  async function remove() {
    setSaving("delete");
    setError("");
    const res = await fetch(
      `/api/schedule?periodStart=${encodeURIComponent(periodStart)}`,
      { method: "DELETE" }
    );
    setSaving(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return setError(data.error ?? "Couldn't delete the draft.");
    }
    onDeleted();
  }

  const unfilled = assignments.filter((a) => !a.instructorId).length;

  // How many classes each instructor ended up with — the fairness check the
  // owner would otherwise do by hand.
  const load = instructors
    .map((i) => ({
      name: i.name,
      count: assignments.filter((a) => a.instructorId === i.id).length,
    }))
    .filter((l) => l.count > 0)
    .sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-5">
      {schedule.notes && (
        <Note tone="sand">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em]">
            What the draft did
          </span>
          {schedule.notes}
        </Note>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={schedule.status === "approved" ? "sage" : "mist"}>
          {schedule.status === "approved" ? "✓ Approved" : "Draft"}
        </Badge>
        <Badge tone="mist">{assignments.length} classes</Badge>
        {unfilled > 0 && (
          <Badge tone="alert">
            {unfilled} still need{unfilled === 1 ? "s" : ""} an instructor
          </Badge>
        )}
        {load.length > 0 && (
          <span className="ml-1 text-xs font-light text-sage">
            {load.map((l) => `${l.name} ${l.count}`).join(" · ")}
          </span>
        )}
      </div>

      <div className="space-y-6">
        {weeks.map((week) => (
          <div key={week.index}>
            <p className="eyebrow mb-2 text-sage">{week.label}</p>
            <div className="overflow-hidden rounded-xl border border-mist/50 bg-white">
              <table className="w-full text-left text-sm">
                <tbody className="divide-y divide-mist/30">
                  {week.classes.map((a) => (
                    <tr
                      key={assignmentKey(a)}
                      className={a.instructorId ? "" : "bg-peach/15"}
                    >
                      <td className="w-36 py-2.5 pl-4 pr-2 align-middle text-fern">
                        {formatDate(a.date)}
                      </td>
                      <td className="w-40 py-2.5 pr-2 align-middle tabular-nums text-fern">
                        {formatTime(a.start)} – {formatTime(a.end)}
                      </td>
                      <td className="py-2.5 pr-2 align-middle">
                        <span className="font-medium text-ink">{a.format}</span>
                        {a.room && (
                          <span className="ml-2 text-xs text-sage">{a.room}</span>
                        )}
                        {a.note && (
                          <span className="mt-0.5 block text-xs font-light italic text-sage">
                            {a.note}
                          </span>
                        )}
                      </td>
                      <td className="w-56 py-2 pr-4 align-middle">
                        <Select
                          value={a.instructorId ?? ""}
                          onChange={(e) => assign(a, e.target.value)}
                          className="py-1.5 text-sm"
                          aria-label={`Instructor for ${a.format} on ${formatDate(a.date)}`}
                        >
                          <option value="">— Needs cover —</option>
                          {instructors.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name}
                            </option>
                          ))}
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {error && <Note tone="alert">{error}</Note>}

      <div className="flex flex-wrap items-center gap-2 border-t border-mist/40 pt-5">
        <Button
          variant="primary"
          onClick={() => save()}
          disabled={saving !== null || !dirty}
        >
          {saving === "save" ? "Saving…" : dirty ? "Save changes" : "Saved"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => save("approved")}
          disabled={saving !== null}
        >
          {saving === "approve" ? "Approving…" : "Approve schedule"}
        </Button>

        <span className="flex-1" />

        {confirmingDelete ? (
          <span className="flex items-center gap-2">
            <span className="text-sm font-light text-fern">
              Delete this draft and start over?
            </span>
            <Button
              variant="danger"
              size="sm"
              onClick={remove}
              disabled={saving !== null}
            >
              {saving === "delete" ? "Deleting…" : "Yes, delete"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmingDelete(false)}
            >
              Keep it
            </Button>
          </span>
        ) : (
          <Button
            variant="danger"
            size="sm"
            onClick={() => setConfirmingDelete(true)}
            disabled={saving !== null}
          >
            Delete draft
          </Button>
        )}
      </div>
    </div>
  );
}
