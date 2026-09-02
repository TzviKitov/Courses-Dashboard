import { notFound } from "next/navigation";
import { Form3Client } from "@/components/followups/Form3Client";
import { getSupabaseAdmin, isSupabaseDbEnabled } from "@/lib/supabase/server";
import { REGISTRATION_SELECT_WITH_NOTES } from "@/lib/followups/access";
import {
  computeFollowupDueDates,
  formsRequireAuth,
  isFormWindowOpen,
} from "@/lib/followups/dates";
import { resolveFormToken } from "@/lib/followups/tokens";
import type { LandingFollowupRow, RegistrationRow } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function TokenForm3Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!isSupabaseDbEnabled() || formsRequireAuth()) notFound();

  const resolved = await resolveFormToken(token);
  if (!resolved || resolved.formType !== "form3") notFound();

  const admin = getSupabaseAdmin();
  const { data: landing } = await admin
    .from("landings")
    .select("id, course, start_date, end_date")
    .eq("id", resolved.landingId)
    .maybeSingle();
  if (!landing) notFound();

  const dues = computeFollowupDueDates(landing.start_date, landing.end_date);
  const [{ data: regs }, { data: followup }] = await Promise.all([
    admin
      .from("registrations")
      .select(REGISTRATION_SELECT_WITH_NOTES)
      .eq("landing_id", resolved.landingId)
      .is("cancelled_at", null)
      .order("created_at", { ascending: true }),
    admin
      .from("landing_followups")
      .select("*")
      .eq("landing_id", resolved.landingId)
      .maybeSingle(),
  ]);

  return (
    <main className="min-h-screen p-4 sm:p-8 max-w-3xl mx-auto" dir="rtl">
      <Form3Client
        landingId={resolved.landingId}
        title={(landing.course as { title?: string })?.title ?? ""}
        open={isFormWindowOpen(dues.form3)}
        dueDate={dues.form3?.toISOString().slice(0, 10) ?? null}
        items={(regs ?? []) as unknown as RegistrationRow[]}
        followup={(followup as LandingFollowupRow | null) ?? null}
        token={token}
        backHref={`/l/${resolved.landingId}`}
      />
    </main>
  );
}
