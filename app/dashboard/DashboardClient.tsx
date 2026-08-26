"use client";

import { useState } from "react";
import type {
  AvailabilitySubmission,
  ClassRequirement,
  Instructor,
  Schedule,
} from "@/lib/types";
import ScheduleGrid from "@/components/ScheduleGrid";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function DashboardClient({
  periodStart,
  initialInstructors,
  initialRequirements,
  initialSubmissions,
  initialSchedule,
}: {
  periodStart: string;
  initialInstructors: Instructor[];
  initialRequirements: ClassRequirement[];
  initialSubmissions: AvailabilitySubmission[];
  initialSchedule: Schedule | null;
}) {
  const [instructors, setInstructors] = useState(initialInstructors);
  const [requirements, setRequirements] = useState(initialRequirements);
  const [submissions] = useState(initialSubmissions);
  const [schedule, setSchedule] = useState(initialSchedule);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");

  // --- add instructor ---
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [formats, setFormats] = useState("");

  async function addInstructor() {
    if (!name.trim()) return;
    const res = await fetch("/api/instructors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        formatsTaught: formats.split(",").map((f) => f.trim()).filter(Boolean),
      }),
    });
    const { instructor } = await res.json();
    setInstructors((s) => [...s, instructor]);
    setName("");
    setEmail("");
    setFormats("");
  }

  // --- add requirement ---
  const [reqDay, setReqDay] = useState("Mon");
  const [reqStart, setReqStart] = useState("09:00");
  const [reqEnd, setReqEnd] = useState("10:00");
  const [reqFormat, setReqFormat] = useState("");
  const [reqRoom, setReqRoom] = useState("");

  async function addRequirement() {
    if (!reqFormat.trim()) return;
    const res = await fetch("/api/requirements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dayOfWeek: reqDay,
        startTime: reqStart,
        endTime: reqEnd,
        format: reqFormat,
        room: reqRoom,
      }),
    });
    const { requirement } = await res.json();
    setRequirements((r) => [...r, requirement]);
    setReqFormat("");
    setReqRoom("");
  }

  async function generate() {
    setGenerating(true);
    setGenError("");
    const res = await fetch("/api/generate-schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodStart }),
    });
    const data = await res.json();
    if (!res.ok) {
      setGenError(data.error ?? "Something went wrong");
    } else {
      setSchedule(data.schedule);
    }
    setGenerating(false);
  }

  const submittedCount = submissions.length;
  const inviteBase = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <main className="mx-auto max-w-5xl space-y-10 px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Studio Scheduler</h1>
        <form action="/api/logout" method="post">
          <button
            type="submit"
            className="text-sm text-gray-500 hover:underline"
            onClick={async (e) => {
              e.preventDefault();
              await fetch("/api/logout", { method: "POST" });
              window.location.href = "/login";
            }}
          >
            Log out
          </button>
        </form>
      </div>

      <p className="text-gray-600">
        Scheduling for the week of <span className="font-medium">{periodStart}</span> —{" "}
        {submittedCount} of {instructors.length} instructors have submitted availability.
      </p>

      {/* Instructors */}
      <section>
        <h2 className="text-lg font-medium text-gray-900">Instructors</h2>
        <div className="mt-3 divide-y divide-gray-200 rounded-lg border border-gray-200">
          {instructors.map((i) => {
            const hasSubmitted = submissions.some((s) => s.instructor_id === i.id);
            return (
              <div key={i.id} className="flex items-center justify-between gap-4 p-3">
                <div>
                  <p className="font-medium text-gray-900">{i.name}</p>
                  <p className="text-sm text-gray-500">{i.formats_taught.join(", ") || "No formats set"}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-sm ${hasSubmitted ? "text-green-600" : "text-amber-600"}`}
                  >
                    {hasSubmitted ? "Submitted" : "Waiting"}
                  </span>
                  <button
                    className="text-sm text-blue-600 hover:underline"
                    onClick={() =>
                      navigator.clipboard.writeText(`${inviteBase}/instructor/${i.invite_token}`)
                    }
                  >
                    Copy invite link
                  </button>
                </div>
              </div>
            );
          })}
          {instructors.length === 0 && (
            <p className="p-3 text-sm text-gray-500">No instructors added yet.</p>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <input
            className="rounded border border-gray-300 px-2 py-1"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="rounded border border-gray-300 px-2 py-1"
            placeholder="Email (optional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="rounded border border-gray-300 px-2 py-1"
            placeholder="Formats taught, comma separated"
            value={formats}
            onChange={(e) => setFormats(e.target.value)}
          />
          <button
            onClick={addInstructor}
            className="rounded bg-gray-900 px-3 py-1 text-white hover:bg-gray-800"
          >
            Add instructor
          </button>
        </div>
      </section>

      {/* Class requirements */}
      <section>
        <h2 className="text-lg font-medium text-gray-900">Required weekly class slots</h2>
        <div className="mt-3 divide-y divide-gray-200 rounded-lg border border-gray-200">
          {requirements.map((r) => (
            <div key={r.id} className="p-3 text-sm text-gray-700">
              {r.day_of_week} {r.start_time}–{r.end_time} — {r.format}
              {r.room ? ` (${r.room})` : ""}
            </div>
          ))}
          {requirements.length === 0 && (
            <p className="p-3 text-sm text-gray-500">No class slots set up yet.</p>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            className="rounded border border-gray-300 px-2 py-1"
            value={reqDay}
            onChange={(e) => setReqDay(e.target.value)}
          >
            {DAYS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <input
            type="time"
            className="rounded border border-gray-300 px-2 py-1"
            value={reqStart}
            onChange={(e) => setReqStart(e.target.value)}
          />
          <input
            type="time"
            className="rounded border border-gray-300 px-2 py-1"
            value={reqEnd}
            onChange={(e) => setReqEnd(e.target.value)}
          />
          <input
            className="rounded border border-gray-300 px-2 py-1"
            placeholder="Format (e.g. Reformer)"
            value={reqFormat}
            onChange={(e) => setReqFormat(e.target.value)}
          />
          <input
            className="rounded border border-gray-300 px-2 py-1"
            placeholder="Room (optional)"
            value={reqRoom}
            onChange={(e) => setReqRoom(e.target.value)}
          />
          <button
            onClick={addRequirement}
            className="rounded bg-gray-900 px-3 py-1 text-white hover:bg-gray-800"
          >
            Add slot
          </button>
        </div>
      </section>

      {/* Schedule generation */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900">Schedule</h2>
          <button
            onClick={generate}
            disabled={generating}
            className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {generating ? "Generating..." : schedule ? "Regenerate draft" : "Generate draft schedule"}
          </button>
        </div>
        {genError && <p className="mt-2 text-red-600">{genError}</p>}

        {schedule && (
          <ScheduleGrid
            periodStart={periodStart}
            schedule={schedule}
            instructors={instructors}
            onSaved={setSchedule}
          />
        )}
      </section>
    </main>
  );
}
