import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const periodStart = searchParams.get("periodStart");
  if (!periodStart) return NextResponse.json({ error: "Missing periodStart" }, { status: 400 });

  const { data, error } = await supabaseAdmin()
    .from("schedules")
    .select("*")
    .eq("period_start", periodStart)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ schedule: data });
}

export async function PUT(req: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { periodStart, assignments, status } = await req.json();
  if (!periodStart) return NextResponse.json({ error: "Missing periodStart" }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (assignments) update.assignments = assignments;
  if (status) {
    update.status = status;
    if (status === "approved") update.approved_at = new Date().toISOString();
  }

  const { data, error } = await supabaseAdmin()
    .from("schedules")
    .update(update)
    .eq("period_start", periodStart)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ schedule: data });
}
