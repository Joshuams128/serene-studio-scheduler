import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { isCategory, DEFAULT_CATEGORY } from "@/lib/categories";

export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin()
    .from("class_requirements")
    .select("*")
    .order("day_of_week", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requirements: data });
}

export async function POST(req: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { dayOfWeek, startTime, endTime, format, room, category } = await req.json();
  if (!dayOfWeek || !startTime || !endTime || !format) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  // The column has a check constraint; reject early with a readable message
  // rather than surfacing a Postgres error.
  if (category !== undefined && !isCategory(category)) {
    return NextResponse.json(
      { error: `Unknown category "${category}"` },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin()
    .from("class_requirements")
    .insert({
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
      format,
      category: category ?? DEFAULT_CATEGORY,
      room: room || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requirement: data });
}

export async function DELETE(req: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { error } = await supabaseAdmin().from("class_requirements").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
