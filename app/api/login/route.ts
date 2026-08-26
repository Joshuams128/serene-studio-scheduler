import { NextResponse } from "next/server";
import { checkPassword, setAuthed } from "@/lib/auth";

export async function POST(req: Request) {
  const { password } = await req.json();

  if (!checkPassword(password)) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  await setAuthed();
  return NextResponse.json({ ok: true });
}
