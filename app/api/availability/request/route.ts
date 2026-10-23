import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import type { Instructor } from "@/lib/types";
import { emailConfigError, sendAvailabilityEmails } from "@/lib/email";

/**
 * Emails instructors their private availability link for a month.
 *   target "all"     — everyone with an email on file (the first invite)
 *   target "waiting" — only people who haven't submitted yet (a reminder)
 *   instructorIds    — just those people, overriding target
 */
export async function POST(req: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const configError = emailConfigError();
  if (configError) return NextResponse.json({ error: configError }, { status: 400 });

  const { periodStart, target, instructorIds } = await req.json();
  if (!periodStart) return NextResponse.json({ error: "Missing periodStart" }, { status: 400 });

  const db = supabaseAdmin();
  const [{ data: instructors, error }, { data: submissions }] = await Promise.all([
    db.from("instructors").select("*").eq("active", true).order("created_at"),
    db.from("availability_submissions").select("instructor_id").eq("period_start", periodStart),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const submitted = new Set((submissions ?? []).map((s) => s.instructor_id));
  const picked = Array.isArray(instructorIds) ? new Set<string>(instructorIds) : null;
  const waiting = target === "waiting";

  const withEmail = ((instructors ?? []) as Instructor[]).filter((i) => i.email?.trim());
  const recipients = withEmail.filter((i) =>
    picked ? picked.has(i.id) : !waiting || !submitted.has(i.id)
  );

  if (recipients.length === 0) {
    return NextResponse.json(
      { error: waiting ? "Everyone with an email on file has already submitted." : "No one to email — add email addresses to your team first." },
      { status: 400 }
    );
  }

  const result = await sendAvailabilityEmails({
    instructors: recipients,
    periodStart,
    origin: new URL(req.url).origin,
    reminder: waiting,
  });

  return NextResponse.json({ ...result, skippedNoEmail: (instructors ?? []).length - withEmail.length });
}
