import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import type { Instructor, Schedule } from "@/lib/types";
import {
  buildRecipients,
  emailConfigError,
  renderScheduleEmail,
  sendScheduleEmails,
} from "@/lib/email";

async function load(periodStart: string) {
  const db = supabaseAdmin();
  const [{ data: schedule }, { data: instructors }] = await Promise.all([
    db.from("schedules").select("*").eq("period_start", periodStart).maybeSingle(),
    db.from("instructors").select("*").eq("active", true).order("created_at"),
  ]);
  return {
    schedule: schedule as Schedule | null,
    instructors: (instructors ?? []) as Instructor[],
  };
}

/**
 * Renders the email in the browser without sending anything, so the owner can
 * check how it reads before it goes to real inboxes.
 */
export async function GET(req: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const periodStart = searchParams.get("periodStart");
  if (!periodStart) return NextResponse.json({ error: "Missing periodStart" }, { status: 400 });

  const { schedule, instructors } = await load(periodStart);
  if (!schedule) {
    return NextResponse.json({ error: "No schedule for that month yet" }, { status: 404 });
  }

  const { sendable } = buildRecipients(instructors, schedule.assignments);
  const requested = searchParams.get("instructorId");
  const pick =
    sendable.find((r) => r.instructor.id === requested) ?? sendable[0] ?? null;

  // With nobody emailable yet, still show what the email would look like.
  const sample = pick ?? {
    instructor: instructors[0] ?? ({ id: "", name: "Sample Instructor" } as Instructor),
    classes: schedule.assignments.filter(
      (a) => a.instructorId && a.instructorId === instructors[0]?.id
    ),
  };

  const { html } = renderScheduleEmail({
    instructor: sample.instructor,
    classes: sample.classes,
    periodStart,
    allAssignments: schedule.assignments,
  });

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function POST(req: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const configError = emailConfigError();
  if (configError) return NextResponse.json({ error: configError }, { status: 400 });

  const { periodStart } = await req.json();
  if (!periodStart) return NextResponse.json({ error: "Missing periodStart" }, { status: 400 });

  const { schedule, instructors } = await load(periodStart);
  if (!schedule) {
    return NextResponse.json(
      { error: "There's no schedule for that month to send." },
      { status: 404 }
    );
  }

  const { sendable, missingEmail } = buildRecipients(
    instructors,
    schedule.assignments
  );

  if (sendable.length === 0) {
    return NextResponse.json(
      {
        error:
          missingEmail.length > 0
            ? "None of your instructors have an email address on file yet."
            : "There's nobody to send to yet.",
      },
      { status: 400 }
    );
  }

  const result = await sendScheduleEmails({
    recipients: sendable,
    periodStart,
    allAssignments: schedule.assignments,
  });

  // Only stamp the schedule if at least one email actually went out, so a
  // total failure doesn't read as "sent" on the dashboard.
  let updated = schedule;
  let warning: string | undefined;

  if (result.sent.length > 0) {
    const { data, error } = await supabaseAdmin()
      .from("schedules")
      .update({
        sent_at: new Date().toISOString(),
        sent_to_count: result.sent.length,
      })
      .eq("period_start", periodStart)
      .select()
      .single();

    if (data) {
      updated = data as Schedule;
    } else if (error) {
      // The emails went out regardless — don't fail the request over it, but
      // say so, because the usual cause is the sent_at/sent_to_count columns
      // never being added (re-run supabase/schema.sql).
      warning =
        "The emails went out, but recording when couldn't be saved — so “last sent” won't show. Re-run supabase/schema.sql to add the sent_at column.";
    }
  }

  return NextResponse.json({
    ...result,
    warning,
    missingEmail: missingEmail.map((i) => i.name),
    schedule: updated,
  });
}
