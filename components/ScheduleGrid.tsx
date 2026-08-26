"use client";

import { useState } from "react";
import type { Instructor, Schedule, ScheduleAssignment } from "@/lib/types";

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function ScheduleGrid({
  periodStart,
  schedule,
  instructors,
  onSaved,
}: {
  periodStart: string;
  schedule: Schedule;
  instructors: Instructor[];
  onSaved: (s: Schedule) => void;
}) {
  const [assignments, setAssignments] = useState<ScheduleAssignment[]>(schedule.assignments);
  const [saving, setSaving] = useState(false);

  const sorted = [...assignments].sort((a, b) => {
    const dayDiff = DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day);
    if (dayDiff !== 0) return dayDiff;
    return a.start.localeCompare(b.start);
  });

  function updateInstructor(requirementId: string, instructorId: string) {
    const instructor = instructors.find((i) => i.id === instructorId);
    setAssignments((prev) =>
      prev.map((a) =>
        a.requirementId === requirementId
          ? {
              ...a,
              instructorId: instructor?.id ?? null,
              instructorName: instructor?.name ?? null,
            }
          : a
      )
    );
  }

  async function save(status?: "approved") {
    setSaving(true);
    const res = await fetch("/api/schedule", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodStart, assignments, status }),
    });
    const data = await res.json();
    if (res.ok) onSaved(data.schedule);
    setSaving(false);
  }

  const unfilled = assignments.filter((a) => !a.instructorId).length;

  return (
    <div className="mt-4">
      {schedule.notes && (
        <div className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">{schedule.notes}</div>
      )}
      {unfilled > 0 && (
        <p className="mb-3 text-sm font-medium text-amber-700">
          {unfilled} slot{unfilled > 1 ? "s" : ""} still need{unfilled === 1 ? "s" : ""} an instructor.
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="p-2">Day</th>
              <th className="p-2">Time</th>
              <th className="p-2">Format</th>
              <th className="p-2">Instructor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((a) => (
              <tr key={a.requirementId} className={!a.instructorId ? "bg-amber-50" : ""}>
                <td className="p-2">{a.day}</td>
                <td className="p-2">{a.start}–{a.end}</td>
                <td className="p-2">{a.format}</td>
                <td className="p-2">
                  <select
                    className="rounded border border-gray-300 px-2 py-1"
                    value={a.instructorId ?? ""}
                    onChange={(e) => updateInstructor(a.requirementId, e.target.value)}
                  >
                    <option value="">— Unassigned —</option>
                    {instructors.map((i) => (
                      <option key={i.id} value={i.id}>{i.name}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => save()}
          disabled={saving}
          className="rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
        <button
          onClick={() => save("approved")}
          disabled={saving}
          className="rounded-lg bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          Approve schedule
        </button>
        {schedule.status === "approved" && (
          <span className="self-center text-sm text-green-700">✓ Approved</span>
        )}
      </div>
    </div>
  );
}
