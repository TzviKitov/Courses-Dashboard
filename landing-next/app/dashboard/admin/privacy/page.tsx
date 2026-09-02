import { DashboardShell } from "@/components/dashboard";
import { AdminSubNav } from "@/components/dashboard/AdminSubNav";
import { requireAdminApi } from "@/lib/admin/require-admin";
import { getSupabaseAdmin, isSupabaseDbEnabled } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminPrivacyPage() {
  if (!isSupabaseDbEnabled()) notFound();
  const gate = await requireAdminApi();
  if (!gate.ok) notFound();

  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("data_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <DashboardShell title="בקשות זכויות נושא מידע" subtitle="סעיפים 13–14 — לטיפול ידני לאחר זיהוי">
      <AdminSubNav />
      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--brand-border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="p-2 text-right">תאריך</th>
              <th className="p-2 text-right">סוג</th>
              <th className="p-2 text-right">שם</th>
              <th className="p-2 text-right">קשר</th>
              <th className="p-2 text-right">סטטוס</th>
              <th className="p-2 text-right">פירוט</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((row) => (
              <tr key={row.id} className="border-t" style={{ borderColor: "var(--brand-border)" }}>
                <td className="p-2">{String(row.created_at).slice(0, 16)}</td>
                <td className="p-2">{row.request_type}</td>
                <td className="p-2">{row.full_name}</td>
                <td className="p-2">{row.email || row.phone}</td>
                <td className="p-2">{row.status}</td>
                <td className="p-2 max-w-xs truncate">{row.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(data ?? []).length === 0 && (
          <p className="p-6 text-sm text-center text-gray-500">אין בקשות עדיין.</p>
        )}
      </div>
    </DashboardShell>
  );
}
