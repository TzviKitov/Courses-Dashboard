import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard";
import { Form1Client } from "@/components/followups/Form1Client";
import { assertPageAccess } from "@/lib/auth/guards";
import { canManageLanding } from "@/lib/auth/admin";
import { getCurrentUser } from "@/lib/supabase/ssr";
import { getSupabaseAdmin, isSupabaseDbEnabled } from "@/lib/supabase/server";
import { REGISTRATION_SELECT } from "@/lib/followups/access";
import {
  computeFollowupDueDates,
  isFormWindowOpen,
} from "@/lib/followups/dates";
import type {
  RegistrationAttachmentRow,
  RegistrationRow,
} from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function Form1Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isSupabaseDbEnabled()) notFound();

  const pathname =
    (await headers()).get("x-pathname") ?? `/dashboard/my/${id}/forms/1`;
  await assertPageAccess(pathname);
  const user = await getCurrentUser();
  if (!user) return null;

  const admin = getSupabaseAdmin();
  const { data: landing } = await admin
    .from("landings")
    .select("id, owner_id, course, start_date, end_date")
    .eq("id", id)
    .maybeSingle();
  if (!landing || !canManageLanding(user, landing.owner_id)) notFound();

  const dues = computeFollowupDueDates(landing.start_date, landing.end_date);
  const [{ data: regs }, { data: attachments }] = await Promise.all([
    admin
      .from("registrations")
      .select(REGISTRATION_SELECT)
      .eq("landing_id", id)
      .is("cancelled_at", null)
      .order("created_at", { ascending: true }),
    admin.from("registration_attachments").select("*").eq("landing_id", id),
  ]);

  return (
    <DashboardShell title="טופס 1">
      <Form1Client
        landingId={id}
        title={(landing.course as { title?: string })?.title ?? ""}
        open={isFormWindowOpen(dues.form1)}
        dueDate={dues.form1?.toISOString().slice(0, 10) ?? null}
        items={(regs ?? []) as RegistrationRow[]}
        attachments={(attachments ?? []) as RegistrationAttachmentRow[]}
        backHref={`/dashboard/my/${id}/registrants`}
      />
    </DashboardShell>
  );
}
