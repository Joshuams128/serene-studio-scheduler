import { supabaseAdmin } from "@/lib/supabase";
import { notFound } from "next/navigation";
import IntakeForm from "./IntakeForm";

export default async function InstructorIntakePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const { data: instructor } = await supabaseAdmin()
    .from("instructors")
    .select("id, name, formats_taught")
    .eq("invite_token", token)
    .single();

  if (!instructor) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-gray-900">Hi {instructor.name} 👋</h1>
      <p className="mt-2 text-gray-600">
        Let us know your availability for the upcoming schedule, and anything
        you&apos;d like us to keep in mind. Takes about a minute.
      </p>
      <IntakeForm token={token} formatsTaught={instructor.formats_taught} />
    </main>
  );
}
