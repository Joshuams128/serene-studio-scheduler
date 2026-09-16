"use client";

import { useMemo, useState } from "react";
import type { Instructor, Schedule, ScheduleAssignment } from "@/lib/types";
import { assignmentKey } from "@/lib/types";
import { formatDate, formatTime, monthLabel, weeksInMonth } from "@/lib/period";
import { Badge, Button, CategoryTabs, Note, Select } from "@/components/ui";
import {
  Chevron,
  usePersistedOpen,
  usePersistedSet,
} from "@/components/Collapsible";
import {
  CATEGORY_LABEL,
  CATEGORY_PLURAL,
  toCategory,
  type Category,
  type CategoryFilter,
} from "@/lib/categories";

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
  const [filter, setFilter] = useState<CategoryFilter>("all");
  // Often several paragraphs — folded by default, with the first line showing.
  const [notesOpen, setNotesOpen] = usePersistedOpen("draft-notes", false);
  // Which week groups are folded away, remembered per month.
  const [closedWeeks, setClosedWeeks] = usePersistedSet(`draft-weeks-${periodStart}`);
  const [saving, setSaving] = useState<"save" | "approve" | "delete" | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState("");

  const [confirmingSend, setConfirmingSend] = useState(false);
  // "all" sends to everyone with an address; "some" sends only to the ticked
  // people. Also the safe way to do a first live test — tick just yourself.
  const [audience, setAudience] = useState<"all" | "some">("all");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  // What goes *in* the email, separate from who receives it: the whole month
  // for context, or only that person's own entries.
  const [scope, setScope] = useState<"full" | "personal">("full");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sendResult, setSendResult] = useState<{
    sent: string[];
    failed: { name: string; email: string; error: string }[];
    warning?: string;
  } | null>(null);

  // The month laid out as weeks, each holding only the classes that fall in it.
  const visible = useMemo(
    () =>
      filter === "all"
        ? assignments
        : assignments.filter((a) => toCategory(a.category) === filter),
    [assignments, filter]
  );

  const weeks = useMemo(() => {
    const byDate = new Map<string, ScheduleAssignment[]>();
    for (const a of visible) {
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
  }, [visible, periodStart]);

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

  async function save(status?: "approved"): Promise<boolean> {
    setSaving(status ? "approve" : "save");
    setError("");
    const res = await fetch("/api/schedule", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodStart, assignments, status }),
    });
    const data = await res.json();
    setSaving(null);
    if (!res.ok) {
      setError(data.error ?? "Couldn't save those changes.");
      return false;
    }
    onSaved(data.schedule);
    setDirty(false);
    return true;
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

  async function saveThenSend() {
    const saved = await save();
    if (saved) await send();
  }

  async function send() {
    setSending(true);
    setSendError("");
    setSendResult(null);
    const res = await fetch("/api/schedule/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        periodStart,
        // Omitted entirely when sending to everyone, so the server keeps its
        // existing "all active people with an address" behaviour.
        ...(audience === "some" ? { instructorIds: [...picked] } : {}),
        includeEveryone: scope === "full",
      }),
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
    // Clear the ticks so the next batch starts from a clean slate. Who was
    // emailed now lives on the schedule row, so it survives a reload.
    setPicked(new Set());
    setConfirmingSend(false);
    if (data.schedule) onSaved(data.schedule);
  }

  const unfilled = visible.filter((a) => !a.instructorId).length;

  const counts: Record<CategoryFilter, number> = {
    all: assignments.length,
    class: assignments.filter((a) => toCategory(a.category) === "class").length,
    shift: assignments.filter((a) => toCategory(a.category) === "shift").length,
  };
  const mixed = counts.class > 0 && counts.shift > 0;

  const withEmail = instructors.filter((i) => i.email?.trim());
  const withoutEmail = instructors.filter((i) => !i.email?.trim());

  // Who this send would actually reach.
  const recipients =
    audience === "all" ? withEmail : withEmail.filter((i) => picked.has(i.id));

  // Everyone emailed so far, from the schedule row rather than page state, so
  // this still reads correctly after a reload or on another device.
  const sentTo = schedule.sent_to ?? [];
  const sentIds = new Set(sentTo.map((r) => r.instructorId));
  const remaining = withEmail.filter((i) => !sentIds.has(i.id));

  function togglePicked(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // How many classes each instructor ended up with — the fairness check the
  // owner would otherwise do by hand.
  // Deliberately counted across every category — one person, one workload.
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
          <button
            type="button"
            onClick={() => setNotesOpen(!notesOpen)}
            aria-expanded={notesOpen}
            className="flex w-full items-center gap-2 text-left"
          >
            <Chevron open={notesOpen} />
            <span className="text-xs font-semibold uppercase tracking-[0.08em]">
              What the draft did
            </span>
            {!notesOpen && (
              <span className="min-w-0 flex-1 truncate text-xs font-normal normal-case opacity-70">
                {schedule.notes}
              </span>
            )}
          </button>
          {notesOpen && <p className="mt-1.5">{schedule.notes}</p>}
        </Note>
      )}

      <CategoryTabs value={filter} onChange={setFilter} counts={counts} allLabel="Everything" />

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={schedule.status === "approved" ? "sage" : "mist"}>
          {schedule.status === "approved" ? "✓ Approved" : "Draft"}
        </Badge>
        <Badge tone="mist">
          {filter === "all"
            ? mixed
              ? `${counts.class} classes · ${counts.shift} shifts`
              : `${counts.all} ${counts.all === 1 ? "entry" : "entries"}`
            : `${counts[filter]} ${CATEGORY_PLURAL[filter as Category].toLowerCase()}`}
        </Badge>
        {unfilled > 0 && (
          <Badge tone="alert">
            {unfilled} still need{unfilled === 1 ? "s" : ""} an instructor
          </Badge>
        )}
        {load.length > 0 && (
          <span className="ml-1 text-xs font-light text-sage">
            {mixed && "Total each: "}
            {load.map((l) => `${l.name} ${l.count}`).join(" · ")}
          </span>
        )}
      </div>

      {weeks.length === 0 && (
        <p className="rounded-xl border border-mist/50 bg-paper px-4 py-8 text-center text-sm font-light text-sage">
          No {CATEGORY_PLURAL[filter as Category].toLowerCase()} in this month&apos;s draft.
        </p>
      )}

      {weeks.length > 1 && (
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setClosedWeeks(new Set(weeks.map((w) => String(w.index))))}
            className="py-1 text-xs font-medium text-clay transition-opacity hover:opacity-70"
          >
            Collapse all weeks
          </button>
          <button
            type="button"
            onClick={() => setClosedWeeks(new Set())}
            className="py-1 text-xs font-medium text-clay transition-opacity hover:opacity-70"
          >
            Expand all
          </button>
        </div>
      )}

      <div className="space-y-6">
        {weeks.map((week) => {
          const weekOpen = !closedWeeks.has(String(week.index));
          const weekUnfilled = week.classes.filter((a) => !a.instructorId).length;
          return (
          <div key={week.index}>
            <button
              type="button"
              aria-expanded={weekOpen}
              onClick={() => {
                const next = new Set(closedWeeks);
                if (weekOpen) next.add(String(week.index));
                else next.delete(String(week.index));
                setClosedWeeks(next);
              }}
              className="-mx-2 mb-2 flex w-[calc(100%+1rem)] items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-paper"
            >
              <Chevron open={weekOpen} />
              <span className="eyebrow text-sage">{week.label}</span>
              <span className="text-xs font-light text-sage">
                {week.classes.length}
                {weekUnfilled > 0 && (
                  <span className="text-[#a4442c]">
                    {" "}
                    · {weekUnfilled} need cover
                  </span>
                )}
              </span>
            </button>
            {weekOpen && (
            <>
            <div className="space-y-2 sm:hidden">
              {week.classes.map((a) => (
                <div
                  key={assignmentKey(a)}
                  className={`rounded-xl border p-3 ${
                    a.instructorId
                      ? "border-mist/50 bg-white"
                      : "border-sand/60 bg-peach/15"
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-ink">
                      {a.format}
                      {filter === "all" && toCategory(a.category) === "shift" && (
                        <span className="ml-1.5 text-xs font-normal text-clay">
                          {CATEGORY_LABEL.shift}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-xs text-fern">
                      {formatDate(a.date)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs tabular-nums text-fern">
                    {formatTime(a.start)} – {formatTime(a.end)}
                    {a.room && <span className="text-sage"> · {a.room}</span>}
                  </p>
                  {a.note && (
                    <p className="mt-1 text-xs font-light italic leading-relaxed text-sage">
                      {a.note}
                    </p>
                  )}
                  <Select
                    value={a.instructorId ?? ""}
                    onChange={(e) => assign(a, e.target.value)}
                    className="mt-2.5 w-full"
                    aria-label={`Instructor for ${a.format} on ${formatDate(a.date)}`}
                  >
                    <option value="">— Needs cover —</option>
                    {instructors.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </Select>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto rounded-xl border border-mist/50 bg-white sm:block">
              <table className="w-full min-w-[34rem] text-left text-sm">
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
                        {filter === "all" && toCategory(a.category) === "shift" && (
                          <span className="ml-2 text-xs text-clay">
                            {CATEGORY_LABEL.shift}
                          </span>
                        )}
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
            </>
            )}
          </div>
          );
        })}
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
              Everyone gets their own {mixed ? "classes and shifts" : "list"} at
              the top, and only the parts of the month that apply to them
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
                {schedule.sent_to_count === 1 ? "person" : "people"}.
              </p>
            )}
            {sentTo.length > 0 && (
              <p className="mt-1 text-xs font-light leading-relaxed text-sage">
                Already emailed ({sentTo.length} of {withEmail.length}):{" "}
                <span className="text-fern">
                  {sentTo.map((r) => r.name).join(", ")}
                </span>
                {remaining.length > 0 ? (
                  <>
                    {" · "}
                    <span className="text-[#a4442c]">
                      still to go: {remaining.map((i) => i.name).join(", ")}
                    </span>
                  </>
                ) : (
                  <span className="text-fern"> · everyone has it</span>
                )}
              </p>
            )}
          </div>

          {!confirmingSend && (
            <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:shrink-0">
              <Button
                variant="secondary"
                size="sm"
                className="flex-1 sm:flex-none"
                onClick={() =>
                  window.open(
                    `/api/schedule/send?periodStart=${encodeURIComponent(
                      periodStart
                    )}${scope === "personal" ? "&personal=1" : ""}`,
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
                className="flex-1 sm:flex-none"
                onClick={() => {
                  setSendResult(null);
                  setSendError("");
                  setConfirmingSend(true);
                }}
                disabled={recipients.length === 0}
                title={
                  withEmail.length === 0
                    ? "Nobody on the team has an email address on file yet"
                    : recipients.length === 0
                      ? "Tick at least one person to send to"
                      : undefined
                }
              >
                {schedule.sent_at ? "Send again" : "Send to"} {recipients.length}{" "}
                {recipients.length === 1 ? "person" : "people"}
              </Button>
            </div>
          )}
        </div>

        {!confirmingSend && withEmail.length > 0 && (
          <div className="mt-4 border-t border-mist/40 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-light text-fern">Send to</span>
              {(
                [
                  ["all", `Everyone (${withEmail.length})`],
                  ["some", "Choose who"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setAudience(key);
                    // Opening the picker starts from nobody, so a stray click
                    // can never mail the whole team.
                    if (key === "some") setPicked(new Set());
                  }}
                  aria-pressed={audience === key}
                  className={`min-h-[2.25rem] rounded-full border px-3.5 py-1.5 text-sm transition-all duration-200 ${
                    audience === key
                      ? "border-clay bg-clay text-shell"
                      : "border-mist bg-white text-fern hover:border-sage hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-sm font-light text-fern">Include</span>
              {(
                [
                  ["full", "Their own + everyone's"],
                  ["personal", "Just their own"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setScope(key)}
                  aria-pressed={scope === key}
                  className={`min-h-[2.25rem] rounded-full border px-3.5 py-1.5 text-sm transition-all duration-200 ${
                    scope === key
                      ? "border-clay bg-clay text-shell"
                      : "border-mist bg-white text-fern hover:border-sage hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs font-light text-sage">
              {scope === "full"
                ? "Each person sees their own entries, then the rest of the month for context."
                : "Each person sees only their own entries — nothing about anyone else."}
            </p>

            {audience === "some" && (
              <div className="mt-3 rounded-xl border border-mist/50 bg-shell p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium text-fern">
                    {picked.size} of {withEmail.length} selected
                  </span>
                  <span className="flex gap-3">
                    {remaining.length > 0 && remaining.length < withEmail.length && (
                      <button
                        type="button"
                        onClick={() => setPicked(new Set(remaining.map((i) => i.id)))}
                        className="py-1 text-xs font-medium text-clay transition-opacity hover:opacity-70"
                      >
                        Select the {remaining.length} not yet emailed
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setPicked(new Set(withEmail.map((i) => i.id)))}
                      className="py-1 text-xs font-medium text-clay transition-opacity hover:opacity-70"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={() => setPicked(new Set())}
                      className="py-1 text-xs font-medium text-clay transition-opacity hover:opacity-70"
                    >
                      Clear
                    </button>
                  </span>
                </div>
                <div className="max-h-56 space-y-0.5 overflow-y-auto">
                  {withEmail.map((i) => (
                    <label
                      key={i.id}
                      className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-paper"
                    >
                      <input
                        type="checkbox"
                        checked={picked.has(i.id)}
                        onChange={() => togglePicked(i.id)}
                        className="h-4 w-4 shrink-0 cursor-pointer rounded border-mist accent-[#BC6C24]"
                      />
                      <span className="min-w-0 text-sm text-ink">
                        {i.name}{" "}
                        <span className="font-light text-sage">
                          {i.email?.trim()}
                        </span>
                        {sentIds.has(i.id) && (
                          <span className="ml-1.5 whitespace-nowrap text-xs text-sage">
                            ✓ emailed{" "}
                            {timeAgo(
                              sentTo.find((r) => r.instructorId === i.id)!.sentAt
                            )}
                          </span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {confirmingSend && (
          <div className="mt-4 rounded-xl border border-clay/25 bg-shell p-4">
            <p className="text-sm font-medium text-ink">
              Send the {monthLabel(periodStart)} schedule to{" "}
              {recipients.length} {recipients.length === 1 ? "person" : "people"}?
            </p>
            <p className="mt-0.5 text-xs font-light text-sage">
              {scope === "full"
                ? "Including the rest of the month for context."
                : "Their own entries only."}
            </p>
            <ul className="mt-2 space-y-0.5">
              {recipients.map((i) => (
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
            {dirty && (
              <div className="mt-3">
                <Note tone="sand">
                  You have unsaved changes to this draft. The email is built
                  from the saved version, so those edits would be left out —
                  they&apos;ll be saved first.
                </Note>
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={dirty ? saveThenSend : send}
                disabled={sending || saving !== null}
              >
                {sending
                  ? "Sending…"
                  : saving === "save"
                    ? "Saving…"
                    : dirty
                      ? "Save changes and send"
                      : "Yes, send now"}
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
                Sent to {sendResult.sent.length}{" "}
                {sendResult.sent.length === 1 ? "person" : "people"}:{" "}
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
