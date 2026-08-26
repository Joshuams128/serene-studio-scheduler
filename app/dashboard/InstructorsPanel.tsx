"use client";

import { useState } from "react";
import type { AvailabilitySubmission, Instructor } from "@/lib/types";
import { formatTime, monthLabel } from "@/lib/period";
import {
  Badge,
  Button,
  Card,
  Empty,
  Field,
  Input,
  SectionHeader,
} from "@/components/ui";

export default function InstructorsPanel({
  periodStart,
  instructors,
  submissions,
  onChange,
}: {
  periodStart: string;
  instructors: Instructor[];
  submissions: AvailabilitySubmission[];
  onChange: (next: Instructor[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [formats, setFormats] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
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

  return (
    <Card>
      <SectionHeader
        eyebrow="Step 1"
        title="Your team"
        description="Each instructor gets a private link. They open it, tick their availability for the month, and you see it land here."
        action={
          !adding && (
            <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
              + Add instructor
            </Button>
          )
        }
      />

      <div className="divide-y divide-mist/30">
        {instructors.map((instructor) => {
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
                      ? instructor.formats_taught.join(" · ")
                      : "No formats set yet"}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
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
                  <div className="flex flex-wrap gap-1.5">
                    {submission.available_slots.length > 0 ? (
                      submission.available_slots.map((slot, i) => (
                        <Badge key={i} tone="mist">
                          {slot.day} {formatTime(slot.start)}–{formatTime(slot.end)}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-sage">
                        No availability given.
                      </span>
                    )}
                  </div>
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

        {instructors.length === 0 && !adding && (
          <Empty>No instructors yet — add your first one to get started.</Empty>
        )}

        {adding && (
          <div className="bg-paper/60 px-6 py-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Priya Sharma"
                  autoFocus
                />
              </Field>
              <Field label="Email" hint="Optional — for your own records.">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="priya@example.com"
                />
              </Field>
              <Field
                label="Formats they teach"
                hint="Comma separated. They can correct this themselves on their link."
                className="sm:col-span-2"
              >
                <Input
                  value={formats}
                  onChange={(e) => setFormats(e.target.value)}
                  placeholder="Reformer, Mat, Serene Blend"
                />
              </Field>
            </div>
            {error && <p className="mt-3 text-sm text-[#a4442c]">{error}</p>}
            <div className="mt-4 flex gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={addInstructor}
                disabled={saving || !name.trim()}
              >
                {saving ? "Adding…" : "Add instructor"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAdding(false);
                  setError("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
