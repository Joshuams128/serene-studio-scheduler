import { supabaseAdmin } from "@/lib/supabase";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isValidPeriod, nextMonthStart, toMonthStart } from "@/lib/period";
import type { AvailabilitySubmission } from "@/lib/types";
import { normalizeStudioHours } from "@/lib/studio";
import IntakeForm from "./IntakeForm";

// Availability changes as instructors submit — never serve a cached copy of
// somebody's form.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Your availability" };

export default async function InstructorIntakePage({
  params,
  searchParams,
}: PageProps<"/instructor/[token]">) {
  const { token } = await params;
  const { period } = await searchParams;

  // The studio's invite link carries the month it's collecting for; on its own
  // the link means "next month", which is the normal planning cycle.
  const raw = Array.isArray(period) ? period[0] : period;
  const periodStart = isValidPeriod(raw) ? toMonthStart(raw) : nextMonthStart();

  const db = supabaseAdmin();

  const { data: instructor } = await db
    .from("instructors")
    .select("id, name, formats_taught")
    .eq("invite_token", token)
    .single();

  if (!instructor) notFound();

  // Anything they already sent for this month, so the form opens pre-filled
  // and they can amend rather than start over. Plus the formats the studio
  // actually runs, offered as one-tap options.
  const [{ data: existing }, { data: requirements }, { data: hoursRows }] =
    await Promise.all([
      db
        .from("availability_submissions")
        .select("*")
        .eq("instructor_id", instructor.id)
        .eq("period_start", periodStart)
        .maybeSingle(),
      db
        .from("class_requirements")
        .select("day_of_week, start_time, end_time, format, category")
        .eq("active", true),
      db.from("studio_hours").select("*"),
    ]);

  // Distinct formats with their category, so the form can group "what do you
  // cover?" into classes and shifts.
  const seen = new Map<string, string>();
  for (const r of requirements ?? []) {
    if (r.format && !seen.has(r.format)) seen.set(r.format, r.category);
  }
  const studioFormats = [...seen.entries()]
    .map(([format, category]) => ({ format, category }))
    .sort((a, b) => a.format.localeCompare(b.format));

  // The weekly timetable itself, so people can tap the classes they can take
  // instead of translating them into hours.
  const timetable = (requirements ?? []).map((r) => ({
    day: r.day_of_week,
    start: String(r.start_time).slice(0, 5),
    end: String(r.end_time).slice(0, 5),
    format: r.format,
  }));

  return (
    <IntakeForm
      token={token}
      periodStart={periodStart}
      name={instructor.name}
      formatsTaught={instructor.formats_taught ?? []}
      studioFormats={studioFormats}
      timetable={timetable}
      existing={(existing as AvailabilitySubmission | null) ?? null}
      studioHours={normalizeStudioHours(hoursRows)}
    />
  );
}
