import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard";
import { AdminSubNav } from "@/components/dashboard/AdminSubNav";
import { requireAdminApi } from "@/lib/admin/require-admin";
import { getSupabaseAdmin, isSupabaseDbEnabled } from "@/lib/supabase/server";
import { listPendingRequests } from "@/lib/landings/co-guide-requests";
import { RequestsList, type RequestItem } from "./RequestsList";

export const dynamic = "force-dynamic";

export default async function CoGuideRequestsPage() {
  if (!isSupabaseDbEnabled()) notFound();
  const gate = await requireAdminApi();
  if (!gate.ok) notFound();

  const pending = await listPendingRequests();
  const admin = getSupabaseAdmin();

  const landingIds = [...new Set(pending.map((r) => r.landing_id))];
  const titles = new Map<string, string>();
  if (landingIds.length > 0) {
    const { data } = await admin.from("landings").select("id, course").in("id", landingIds);
    for (const row of data ?? []) {
      titles.set(row.id as string, (row.course as { title?: string })?.title || "ללא כותרת");
    }
  }

  const requesterIds = [...new Set(pending.map((r) => r.requested_by).filter(Boolean))] as string[];
  const requesters = new Map<string, string>();
  if (requesterIds.length > 0) {
    const { data } = await admin.from("profiles").select("id, display_name").in("id", requesterIds);
    for (const row of data ?? []) {
      requesters.set(row.id as string, (row.display_name as string) || "מדריך");
    }
  }

  const items: RequestItem[] = pending.map((r) => ({
    id: r.id,
    email: r.email,
    name: r.display_name,
    landingId: r.landing_id,
    courseTitle: titles.get(r.landing_id) ?? "קורס שנמחק",
    requestedBy: r.requested_by ? requesters.get(r.requested_by) ?? "מדריך" : "לא ידוע",
  }));

  return (
    <DashboardShell
      title="בקשות להזמנת מדריך שותף"
      subtitle="אישור שולח למדריך החדש הזמנה למייל ומוסיף אותו לקורס"
    >
      <AdminSubNav />
      <RequestsList items={items} />
    </DashboardShell>
  );
}
