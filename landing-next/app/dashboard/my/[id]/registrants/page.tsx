import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard";
import { assertPageAccess } from "@/lib/auth/guards";
import { getCurrentUser } from "@/lib/supabase/ssr";
import { getSupabaseAdmin, isSupabaseDbEnabled } from "@/lib/supabase/server";
import { userCanManageLanding } from "@/lib/auth/admin";
import { REGISTRATION_SELECT } from "@/lib/followups/access";
import {
  computeFollowupDueDates,
  isFormWindowOpen,
} from "@/lib/followups/dates";
import type {
  RegistrationAttachmentRow,
  RegistrationRow,
} from "@/lib/supabase/types";
import { RegistrantsTable } from "./RegistrantsTable";

export const dynamic = "force-dynamic";

export default async function RegistrantsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!isSupabaseDbEnabled()) {
    return (
      <DashboardShell title="נרשמים">
        <p className="text-sm" style={{ color: "var(--brand-text-muted)" }}>
          נדרש USE_SUPABASE_DB=true.
        </p>
      </DashboardShell>
    );
  }

  const pathname =
    (await headers()).get("x-pathname") ?? `/dashboard/my/${id}/registrants`;
  await assertPageAccess(pathname);

  const user = await getCurrentUser();
  if (!user) return null;

  const admin = getSupabaseAdmin();

  const [landingResult, regsResult, attachmentsResult] = await Promise.all([
    admin
      .from("landings")
      .select("id, owner_id, course, start_date, end_date")
      .eq("id", id)
      .maybeSingle(),
    admin
      .from("registrations")
      .select(REGISTRATION_SELECT)
      .eq("landing_id", id)
      .order("created_at", { ascending: false }),
    admin
      .from("registration_attachments")
      .select(
        "id, registration_id, landing_id, file_name, storage_path, mime_type, size_bytes, created_at, created_by"
      )
      .eq("landing_id", id),
  ]);

  const landing = landingResult.data;
  if (
    !landing ||
    !(await userCanManageLanding(user, id, landing.owner_id))
  ) {
    notFound();
  }

  const dues = computeFollowupDueDates(landing.start_date, landing.end_date);

  return (
    <DashboardShell title="נרשמים לקורס">
      <RegistrantsTable
        landingId={id}
        title={(landing.course as { title?: string })?.title ?? ""}
        items={(regsResult.data ?? []) as RegistrationRow[]}
        attachments={(attachmentsResult.data ?? []) as RegistrationAttachmentRow[]}
        windows={{
          form1: isFormWindowOpen(dues.form1),
          form2: isFormWindowOpen(dues.form2),
          form3: isFormWindowOpen(dues.form3),
        }}
        dueDates={{
          form1: dues.form1?.toISOString().slice(0, 10) ?? null,
          form2: dues.form2?.toISOString().slice(0, 10) ?? null,
          form3: dues.form3?.toISOString().slice(0, 10) ?? null,
        }}
      />
    </DashboardShell>
  );
}
