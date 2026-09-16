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

// Edit an entry in place — fixing a mistyped format shouldn't mean deleting
// and re-adding it. Only the fields sent are changed.
export async function PATCH(req: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, dayOfWeek, startTime, endTime, format, category, room } =
    await req.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  if (category !== undefined && !isCategory(category)) {
    return NextResponse.json({ error: `Unknown category "${category}"` }, { status: 400 });
  }
  if (format !== undefined && !String(format).trim()) {
    return NextResponse.json({ error: "Format can't be empty" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (dayOfWeek !== undefined) update.day_of_week = dayOfWeek;
  if (startTime !== undefined) update.start_time = startTime;
  if (endTime !== undefined) update.end_time = endTime;
  if (format !== undefined) update.format = String(format).trim();
  if (category !== undefined) update.category = category;
  if (room !== undefined) update.room = String(room).trim() || null;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin()
    .from("class_requirements")
    .update(update)
    .eq("id", id)
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
