import { supabaseAdmin } from "@/lib/supabase";
import DashboardClient from "./DashboardClient";

// This page reads live, frequently-changing data (submissions, schedule
// drafts) and sits behind the owner-only proxy check — it must never be
// statically cached/prerendered.
export const dynamic = "force-dynamic";

function nextMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = (8 - day) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export default async function DashboardPage() {
  const db = supabaseAdmin();
  const periodStart = nextMonday();

  const [{ data: instructors }, { data: requirements }, { data: submissions }, { data: schedule }] =
    await Promise.all([
      db.from("instructors").select("*").order("created_at", { ascending: true }),
      db.from("class_requirements").select("*").order("day_of_week", { ascending: true }),
      db.from("availability_submissions").select("*").eq("period_start", periodStart),
      db.from("schedules").select("*").eq("period_start", periodStart).maybeSingle(),
    ]);

  return (
    <DashboardClient
      periodStart={periodStart}
      initialInstructors={instructors ?? []}
      initialRequirements={requirements ?? []}
      initialSubmissions={submissions ?? []}
      initialSchedule={schedule ?? null}
    />
  );
}
