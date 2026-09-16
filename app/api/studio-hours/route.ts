import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { DAYS } from "@/lib/period";
import { normalizeStudioHours } from "@/lib/studio";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin().from("studio_hours").select("*");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ hours: normalizeStudioHours(data) });
}

export async function PATCH(req: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { hours } = await req.json();
  if (!hours || typeof hours !== "object") {
    return NextResponse.json({ error: "Missing hours" }, { status: 400 });
  }

  for (const day of DAYS) {
    const w = hours[day];
    if (!w || !TIME_RE.test(w.start) || !TIME_RE.test(w.end)) {
      return NextResponse.json(
        { error: `Missing or invalid hours for ${day}` },
        { status: 400 }
      );
    }
    if (w.start >= w.end) {
      return NextResponse.json(
        { error: `${day}'s opening time must be before its closing time` },
        { status: 400 }
      );
    }
  }

  const rows = DAYS.map((day) => ({
    day_of_week: day,
    start_time: hours[day].start,
    end_time: hours[day].end,
  }));

  const { data, error } = await supabaseAdmin()
    .from("studio_hours")
    .upsert(rows, { onConflict: "day_of_week" })
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ hours: normalizeStudioHours(data) });
}
