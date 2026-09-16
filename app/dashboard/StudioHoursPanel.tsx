"use client";

import { useState } from "react";
import { DAYS, DAY_LABELS, type Day } from "@/lib/period";
import { studioHoursLabel, type StudioHours } from "@/lib/studio";
import { Button, Field, Input, Note } from "@/components/ui";
import CollapsibleCard from "@/components/Collapsible";

function allSame(hours: StudioHours): boolean {
  return DAYS.every(
    (d) => hours[d].start === hours.Mon.start && hours[d].end === hours.Mon.end
  );
}

/**
 * When the studio opens and closes. Set once and rarely touched, so it lives
 * folded away here rather than as a numbered step — but it drives the
 * defaults on the instructor form and the weekly template, so it needs to be
 * easy to find and change.
 */
export default function StudioHoursPanel({
  hours,
  onChange,
}: {
  hours: StudioHours;
  onChange: (next: StudioHours) => void;
}) {
  const [draft, setDraft] = useState(hours);
  const [sameEveryDay, setSameEveryDay] = useState(() => allSame(hours));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function setDay(day: Day, field: "start" | "end", value: string) {
    setSaved(false);
    setDraft((prev) => ({ ...prev, [day]: { ...prev[day], [field]: value } }));
  }

  function setAllDays(field: "start" | "end", value: string) {
    setSaved(false);
    setDraft(
      (prev) =>
        Object.fromEntries(
          DAYS.map((d) => [d, { ...prev[d], [field]: value }])
        ) as StudioHours
    );
  }

  function toggleSameEveryDay(checked: boolean) {
    setSaved(false);
    setSameEveryDay(checked);
    if (checked) {
      setDraft(
        (prev) =>
          Object.fromEntries(DAYS.map((d) => [d, { ...prev.Mon }])) as StudioHours
      );
    }
  }

  async function save() {
    setSaving(true);
    setError("");
    const res = await fetch("/api/studio-hours", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hours: draft }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) return setError(data.error ?? "Couldn't save studio hours.");
    onChange(data.hours);
    setDraft(data.hours);
    setSaved(true);
  }

  return (
    <CollapsibleCard
      id="studio-hours"
      eyebrow="Settings"
      title="Studio hours"
      description="When the studio is open. Sets the default hours offered on the instructor form and the weekly template — change it any time."
      summary={
        allSame(hours)
          ? `Every day · ${studioHoursLabel(hours, "Mon")}`
          : "Hours vary by day"
      }
      defaultOpen={false}
    >
      <div className="space-y-4 px-6 py-5">
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={sameEveryDay}
            onChange={(e) => toggleSameEveryDay(e.target.checked)}
            className="h-5 w-5 shrink-0 cursor-pointer rounded border-mist accent-[#BC6C24]"
          />
          <span className="text-sm font-medium text-ink">Same hours every day</span>
        </label>

        {sameEveryDay ? (
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Opens">
              <Input
                type="time"
                value={draft.Mon.start}
                onChange={(e) => setAllDays("start", e.target.value)}
                className="w-32"
              />
            </Field>
            <Field label="Closes">
              <Input
                type="time"
                value={draft.Mon.end}
                onChange={(e) => setAllDays("end", e.target.value)}
                className="w-32"
              />
            </Field>
          </div>
        ) : (
          <div className="space-y-3">
            {DAYS.map((d) => (
              <div key={d} className="flex flex-wrap items-center gap-3">
                <span className="w-24 shrink-0 text-sm font-medium text-ink">
                  {DAY_LABELS[d]}
                </span>
                <Input
                  type="time"
                  value={draft[d].start}
                  onChange={(e) => setDay(d, "start", e.target.value)}
                  className="w-32"
                  aria-label={`${DAY_LABELS[d]} opens`}
                />
                <span className="text-sm font-light text-sage">to</span>
                <Input
                  type="time"
                  value={draft[d].end}
                  onChange={(e) => setDay(d, "end", e.target.value)}
                  className="w-32"
                  aria-label={`${DAY_LABELS[d]} closes`}
                />
              </div>
            ))}
          </div>
        )}

        {error && <Note tone="alert">{error}</Note>}
        {saved && !error && <Note tone="sage">Saved.</Note>}

        <div>
          <Button variant="primary" size="sm" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save hours"}
          </Button>
        </div>
      </div>
    </CollapsibleCard>
  );
}
