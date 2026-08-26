import { cookies } from "next/headers";

// Deliberately simple: this is an internal trial tool used by one studio
// owner, not a multi-tenant product, so a single shared password gate is
// enough. Swap for real auth (NextAuth, etc.) if this graduates past trial.
const COOKIE_NAME = "studio_scheduler_session";

export async function isAuthed() {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value === "ok";
}

export async function setAuthed() {
  const store = await cookies();
  store.set(COOKIE_NAME, "ok", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export async function clearAuthed() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export function checkPassword(password: string) {
  const expected = process.env.OWNER_PASSWORD;
  if (!expected) {
    throw new Error("Missing OWNER_PASSWORD environment variable");
  }
  return password === expected;
}
