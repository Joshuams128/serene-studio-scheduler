"use client";

import { useMemo, useState } from "react";
import type { Instructor, Schedule, ScheduleAssignment } from "@/lib/types";
import { assignmentKey } from "@/lib/types";
import { formatDate, formatTime, monthLabel, weeksInMonth } from "@/lib/period";
import { Badge, Button, Note, Select } from "@/components/ui";

/** "2 hours ago" — enough precision for a "last sent" line. */
function timeAgo(iso: string): string {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 90) return "just now";
  const units: [number, string][] = [
    [60, "minute"],
    [60, "hour"],
    [24, "day"],
  ];
  let value = seconds;
  let label = "second";
  for (const [size, next] of units) {
    if (value < size) break;
    value = Math.round(value / size);
    label = next;
  }
  return `${value} ${label}${value === 1 ? "" : "s"} ago`;
}

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

  const [confirmingSend, setConfirmingSend] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sendResult, setSendResult] = useState<{
    sent: string[];
    failed: { name: string; email: string; error: string }[];
    warning?: string;
  } | null>(null);

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

  async function send() {
    setSending(true);
    setSendError("");
    setSendResult(null);
    const res = await fetch("/api/schedule/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodStart }),
    });
    const data = await res.json();
    setSending(false);
    if (!res.ok) {
      setSendError(data.error ?? "Couldn't send the emails.");
      return;
    }
    setSendResult({
      sent: data.sent,
      failed: data.failed,
      warning: data.warning,
    });
    setConfirmingSend(false);
    if (data.schedule) onSaved(data.schedule);
  }

  const unfilled = assignments.filter((a) => !a.instructorId).length;

  const withEmail = instructors.filter((i) => i.email?.trim());
  const withoutEmail = instructors.filter((i) => !i.email?.trim());

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

      {/* --- Send it out ------------------------------------------------- */}
      <div className="rounded-2xl border border-mist/50 bg-paper/70 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="eyebrow mb-1.5 text-sage">Send it out</p>
            <h3 className="text-base font-medium text-ink">
              Email this schedule to your team
            </h3>
            <p className="mt-1 max-w-lg text-sm font-light leading-relaxed text-fern">
              Everyone gets their own classes at the top and the full month
              underneath.{" "}
              {withoutEmail.length > 0 && (
                <span className="text-[#a4442c]">
                  {withoutEmail.map((i) => i.name).join(", ")}{" "}
                  {withoutEmail.length === 1 ? "has" : "have"} no email address
                  yet — add one on their card above and they&apos;ll be included.
                </span>
              )}
            </p>
            {schedule.sent_at && (
              <p className="mt-2 text-xs font-light text-sage">
                Last sent {timeAgo(schedule.sent_at)} to {schedule.sent_to_count}{" "}
                instructor{schedule.sent_to_count === 1 ? "" : "s"}.
              </p>
            )}
          </div>

          {!confirmingSend && (
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  window.open(
                    `/api/schedule/send?periodStart=${encodeURIComponent(periodStart)}`,
                    "_blank",
                    "noopener"
                  )
                }
              >
                Preview the email
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setSendResult(null);
                  setSendError("");
                  setConfirmingSend(true);
                }}
                disabled={withEmail.length === 0}
                title={
                  withEmail.length === 0
                    ? "No instructor has an email address on file yet"
                    : undefined
                }
              >
                {schedule.sent_at ? "Send again" : "Send to"} {withEmail.length}{" "}
                instructor{withEmail.length === 1 ? "" : "s"}
              </Button>
            </div>
          )}
        </div>

        {confirmingSend && (
          <div className="mt-4 rounded-xl border border-clay/25 bg-shell p-4">
            <p className="text-sm font-medium text-ink">
              Send the {monthLabel(periodStart)} schedule to{" "}
              {withEmail.length} instructor{withEmail.length === 1 ? "" : "s"}?
            </p>
            <ul className="mt-2 space-y-0.5">
              {withEmail.map((i) => (
                <li key={i.id} className="text-sm font-light text-fern">
                  {i.name}{" "}
                  <span className="text-sage">&lt;{i.email?.trim()}&gt;</span>
                </li>
              ))}
            </ul>
            {unfilled > 0 && (
              <p className="mt-3 text-sm font-light text-[#a4442c]">
                {unfilled} class{unfilled === 1 ? "" : "es"} still {unfilled === 1 ? "has" : "have"} no
                instructor — {unfilled === 1 ? "it" : "they"} will show as
                “Needs cover” in the email.
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={send}
                disabled={sending}
              >
                {sending ? "Sending…" : "Yes, send now"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmingSend(false)}
                disabled={sending}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {sendError && (
          <div className="mt-4">
            <Note tone="alert">{sendError}</Note>
          </div>
        )}

        {sendResult && (
          <div className="mt-4 space-y-2">
            {sendResult.sent.length > 0 && (
              <Note tone="sage">
                Sent to {sendResult.sent.length} instructor
                {sendResult.sent.length === 1 ? "" : "s"}:{" "}
                {sendResult.sent.join(", ")}.
              </Note>
            )}
            {sendResult.warning && (
              <Note tone="sand">{sendResult.warning}</Note>
            )}
            {sendResult.failed.length > 0 && (
              <Note tone="alert">
                Couldn&apos;t reach{" "}
                {sendResult.failed
                  .map((f) => `${f.name} (${f.error})`)
                  .join(", ")}
                . Check their address and try again.
              </Note>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
