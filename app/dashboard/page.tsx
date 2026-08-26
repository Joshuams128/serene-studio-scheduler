import { supabaseAdmin } from "@/lib/supabase";
import { isValidPeriod, nextMonthStart, toMonthStart } from "@/lib/period";
import DashboardClient from "./DashboardClient";

// This page reads live, frequently-changing data (submissions, schedule
// drafts) and sits behind the owner-only proxy check — it must never be
// statically cached/prerendered.
export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: PageProps<"/dashboard">) {
  const { period } = await searchParams;

  // This is a planning tool, so it opens on the month being *built* — next
  // month — with ‹ › in the header to reach any other. ?period= carries the
  // choice; anything unparseable falls back rather than erroring.
  const raw = Array.isArray(period) ? period[0] : period;
  const periodStart = isValidPeriod(raw) ? toMonthStart(raw) : nextMonthStart();

  const db = supabaseAdmin();

  const [{ data: instructors }, { data: requirements }, { data: submissions }, { data: schedule }] =
    await Promise.all([
      db.from("instructors").select("*").order("created_at", { ascending: true }),
      db.from("class_requirements").select("*").order("start_time", { ascending: true }),
      db.from("availability_submissions").select("*").eq("period_start", periodStart),
      db.from("schedules").select("*").eq("period_start", periodStart).maybeSingle(),
    ]);

  return (
    // Keyed on the period so switching months remounts with fresh state
    // rather than leaving last month's draft in the client component.
    <DashboardClient
      key={periodStart}
      periodStart={periodStart}
      initialInstructors={instructors ?? []}
      initialRequirements={requirements ?? []}
      initialSubmissions={submissions ?? []}
      initialSchedule={schedule ?? null}
    />
  );
}
