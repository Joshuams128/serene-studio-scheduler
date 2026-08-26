import { supabaseAdmin } from "@/lib/supabase";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isValidPeriod, nextMonthStart, toMonthStart } from "@/lib/period";
import type { AvailabilitySubmission } from "@/lib/types";
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
  const [{ data: existing }, { data: requirements }] = await Promise.all([
    db
      .from("availability_submissions")
      .select("*")
      .eq("instructor_id", instructor.id)
      .eq("period_start", periodStart)
      .maybeSingle(),
    db.from("class_requirements").select("format").eq("active", true),
  ]);

  const studioFormats = [
    ...new Set((requirements ?? []).map((r) => r.format).filter(Boolean)),
  ].sort();

  return (
    <IntakeForm
      token={token}
      periodStart={periodStart}
      name={instructor.name}
      formatsTaught={instructor.formats_taught ?? []}
      studioFormats={studioFormats}
      existing={(existing as AvailabilitySubmission | null) ?? null}
    />
  );
}
