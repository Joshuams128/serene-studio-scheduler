import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { generateSchedule } from "@/lib/claude";

export async function POST(req: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { periodStart } = await req.json();
  if (!periodStart) return NextResponse.json({ error: "Missing periodStart" }, { status: 400 });

  const db = supabaseAdmin();

  const [{ data: instructors, error: iErr }, { data: submissions, error: sErr }, { data: requirements, error: rErr }] =
    await Promise.all([
      db.from("instructors").select("*").eq("active", true),
      db.from("availability_submissions").select("*").eq("period_start", periodStart),
      db.from("class_requirements").select("*").eq("active", true),
    ]);

  if (iErr || sErr || rErr) {
    return NextResponse.json({ error: (iErr || sErr || rErr)?.message }, { status: 500 });
  }

  if (!requirements || requirements.length === 0) {
    return NextResponse.json(
      { error: "No class requirements set up yet — add your weekly class slots first." },
      { status: 400 }
    );
  }

  try {
    const { assignments, summary } = await generateSchedule({
      periodStart,
      instructors: instructors ?? [],
      submissions: submissions ?? [],
      requirements: requirements ?? [],
    });

    const { data: schedule, error } = await db
      .from("schedules")
      .upsert(
        {
          period_start: periodStart,
          status: "draft",
          assignments,
          notes: summary,
          generated_at: new Date().toISOString(),
          approved_at: null,
        },
        { onConflict: "period_start" }
      )
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ schedule });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate schedule";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
