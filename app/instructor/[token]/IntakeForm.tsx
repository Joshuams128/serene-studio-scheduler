"use client";

import { useState } from "react";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

type Slot = { day: string; start: string; end: string };

function nextMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = (8 - day) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export default function IntakeForm({
  token,
  formatsTaught,
}: {
  token: string;
  formatsTaught: string[];
}) {
  const [slots, setSlots] = useState<Slot[]>([{ day: "Mon", start: "09:00", end: "12:00" }]);
  const [preferences, setPreferences] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");

  function updateSlot(i: number, patch: Partial<Slot>) {
    setSlots((s) => s.map((slot, idx) => (idx === i ? { ...slot, ...patch } : slot)));
  }

  async function submit() {
    setStatus("saving");
    const res = await fetch("/api/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        periodStart: nextMonday(),
        availableSlots: slots,
        preferences,
      }),
    });
    setStatus(res.ok ? "done" : "error");
  }

  if (status === "done") {
    return (
      <p className="mt-8 rounded-lg bg-green-50 p-4 text-green-800">
        Thanks! Your availability has been submitted.
      </p>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      <div>
        <h2 className="font-medium text-gray-900">You teach:</h2>
        <p className="text-gray-600">{formatsTaught.join(", ") || "Not set yet — let the studio know if this looks wrong."}</p>
      </div>

      <div>
        <h2 className="font-medium text-gray-900">When are you available?</h2>
        <div className="mt-3 space-y-3">
          {slots.map((slot, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <select
                className="rounded border border-gray-300 px-2 py-1"
                value={slot.day}
                onChange={(e) => updateSlot(i, { day: e.target.value })}
              >
                {DAYS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <input
                type="time"
                className="rounded border border-gray-300 px-2 py-1"
                value={slot.start}
                onChange={(e) => updateSlot(i, { start: e.target.value })}
              />
              <span className="text-gray-500">to</span>
              <input
                type="time"
                className="rounded border border-gray-300 px-2 py-1"
                value={slot.end}
                onChange={(e) => updateSlot(i, { end: e.target.value })}
              />
              <button
                type="button"
                className="text-sm text-red-600 hover:underline"
                onClick={() => setSlots((s) => s.filter((_, idx) => idx !== i))}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="mt-3 text-sm font-medium text-blue-600 hover:underline"
          onClick={() => setSlots((s) => [...s, { day: "Mon", start: "09:00", end: "12:00" }])}
        >
          + Add another block
        </button>
      </div>

      <div>
        <h2 className="font-medium text-gray-900">Anything else to keep in mind?</h2>
        <textarea
          className="mt-2 w-full rounded border border-gray-300 p-2"
          rows={3}
          placeholder="e.g. prefer mornings, no back-to-back classes, out of town the last week..."
          value={preferences}
          onChange={(e) => setPreferences(e.target.value)}
        />
      </div>

      <button
        onClick={submit}
        disabled={status === "saving"}
        className="rounded-lg bg-gray-900 px-4 py-2 font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {status === "saving" ? "Submitting..." : "Submit availability"}
      </button>
      {status === "error" && (
        <p className="text-red-600">Something went wrong — please try again.</p>
      )}
    </div>
  );
}
