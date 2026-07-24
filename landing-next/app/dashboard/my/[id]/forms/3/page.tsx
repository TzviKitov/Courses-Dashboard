import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard";
import { Form3Client } from "@/components/followups/Form3Client";
import { assertPageAccess } from "@/lib/auth/guards";
import { canManageLanding } from "@/lib/auth/admin";
import { getCurrentUser } from "@/lib/supabase/ssr";
import { getSupabaseAdmin, isSupabaseDbEnabled } from "@/lib/supabase/server";
import { REGISTRATION_SELECT } from "@/lib/followups/access";
import {
  computeFollowupDueDates,
  isFormWindowOpen,
} from "@/lib/followups/dates";
import type { LandingFollowupRow, RegistrationRow } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function Form3Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isSupabaseDbEnabled()) notFound();

  const pathname =
    (await headers()).get("x-pathname") ?? `/dashboard/my/${id}/forms/3`;
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
  const [{ data: regs }, { data: followup }] = await Promise.all([
    admin
      .from("registrations")
      .select(REGISTRATION_SELECT)
      .eq("landing_id", id)
      .is("cancelled_at", null)
      .order("created_at", { ascending: true }),
    admin.from("landing_followups").select("*").eq("landing_id", id).maybeSingle(),
  ]);

  return (
    <DashboardShell title="טופס 3">
      <Form3Client
        landingId={id}
        title={(landing.course as { title?: string })?.title ?? ""}
        open={isFormWindowOpen(dues.form3)}
        dueDate={dues.form3?.toISOString().slice(0, 10) ?? null}
        items={(regs ?? []) as RegistrationRow[]}
        followup={(followup as LandingFollowupRow | null) ?? null}
        backHref={`/dashboard/my/${id}/registrants`}
      />
    </DashboardShell>
  );
}
