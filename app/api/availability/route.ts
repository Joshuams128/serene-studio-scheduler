import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Public route — access is controlled by knowing the instructor's unique
// invite token, not a login. Only the token owner can see/submit their own
// availability; this route never returns other instructors' data.
export async function POST(req: Request) {
  const { token, periodStart, availableSlots, preferences, formatsTaught } =
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

  const { error } = await db.from("availability_submissions").upsert(
    {
      instructor_id: instructor.id,
      period_start: periodStart,
      available_slots: availableSlots ?? [],
      preferences: preferences ?? "",
      submitted_at: new Date().toISOString(),
    },
    { onConflict: "instructor_id,period_start" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, instructorName: instructor.name });
}
