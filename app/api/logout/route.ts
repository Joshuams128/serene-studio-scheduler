import { NextResponse } from "next/server";
import { clearAuthed } from "@/lib/auth";

export async function POST() {
  await clearAuthed();
  return NextResponse.json({ ok: true });
}
