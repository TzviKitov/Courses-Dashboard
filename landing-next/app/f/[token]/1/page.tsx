import { notFound } from "next/navigation";
import { Form1Client } from "@/components/followups/Form1Client";
import { getSupabaseAdmin, isSupabaseDbEnabled } from "@/lib/supabase/server";
import { REGISTRATION_SELECT } from "@/lib/followups/access";
import {
  computeFollowupDueDates,
  formsRequireAuth,
  isFormWindowOpen,
} from "@/lib/followups/dates";
import { resolveFormToken } from "@/lib/followups/tokens";
import type {
  RegistrationAttachmentRow,
  RegistrationRow,
} from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function TokenForm1Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!isSupabaseDbEnabled() || formsRequireAuth()) notFound();

  const resolved = await resolveFormToken(token);
  if (!resolved || resolved.formType !== "form1") notFound();

  const admin = getSupabaseAdmin();
  const { data: landing } = await admin
    .from("landings")
    .select("id, course, start_date, end_date")
    .eq("id", resolved.landingId)
    .maybeSingle();
  if (!landing) notFound();

  const dues = computeFollowupDueDates(landing.start_date, landing.end_date);
  const [{ data: regs }, { data: attachments }] = await Promise.all([
    admin
      .from("registrations")
      .select(REGISTRATION_SELECT)
      .eq("landing_id", resolved.landingId)
      .is("cancelled_at", null)
      .order("created_at", { ascending: true }),
    admin
      .from("registration_attachments")
      .select("*")
      .eq("landing_id", resolved.landingId),
  ]);

  return (
    <main className="min-h-screen p-4 sm:p-8 max-w-3xl mx-auto" dir="rtl">
      <Form1Client
        landingId={resolved.landingId}
        title={(landing.course as { title?: string })?.title ?? ""}
        open={isFormWindowOpen(dues.form1)}
        dueDate={dues.form1?.toISOString().slice(0, 10) ?? null}
        items={(regs ?? []) as RegistrationRow[]}
        attachments={(attachments ?? []) as RegistrationAttachmentRow[]}
        token={token}
        backHref={`/l/${resolved.landingId}`}
      />
    </main>
  );
}
