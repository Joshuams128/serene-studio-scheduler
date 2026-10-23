import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Public route — access is controlled by knowing the instructor's unique
// invite token, not a login. Only the token owner can see/submit their own
// availability; this route never returns other instructors' data.
export async function POST(req: Request) {
  const { token, periodStart, availableSlots, preferences, formatsTaught, minPerWeek, maxPerWeek } =
    await req.json();

  if (!token || !periodStart) {
    return NextResponse.json({ error: "Missing token or periodStart" }, { status: 400 });
  }

  const db = supabaseAdmin();

  const { data: instructor, error: lookupError } = await db
    .from("instructors")
    .select("id, name")
    .eq("invite_token", token)
    .single();

  if (lookupError || !instructor) {
    return NextResponse.json({ error: "Invalid link" }, { status: 404 });
  }

  // Instructors confirm what they teach on the same form, so keep their
  // profile in step with what they just told us. Scoped by their own token —
  // they can only ever edit their own record.
  if (Array.isArray(formatsTaught)) {
    await db
      .from("instructors")
      .update({ formats_taught: formatsTaught.filter(Boolean) })
      .eq("id", instructor.id);
  }

  const row = {
    instructor_id: instructor.id,
    period_start: periodStart,
    available_slots: availableSlots ?? [],
    preferences: preferences ?? "",
    submitted_at: new Date().toISOString(),
  };
  const limits = { min_per_week: toLimit(minPerWeek), max_per_week: toLimit(maxPerWeek) };

  let { error } = await db
    .from("availability_submissions")
    .upsert({ ...row, ...limits }, { onConflict: "instructor_id,period_start" });

  // If schema.sql hasn't been re-run yet the limit columns don't exist; save
  // everything else rather than lose the whole submission.
  if (error && /min_per_week|max_per_week/.test(error.message)) {
    ({ error } = await db
      .from("availability_submissions")
      .upsert(row, { onConflict: "instructor_id,period_start" }));
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, instructorName: instructor.name });
}

/** A whole number of classes per week, or null for "no limit". */
function toLimit(value: unknown): number | null {
  const n = Number(value);
  return value !== "" && value != null && Number.isInteger(n) && n >= 0 && n <= 40 ? n : null;
}
