import { Suspense } from "react";
import { DashboardShell } from "@/components/dashboard";
import { AdminSubNav } from "@/components/dashboard/AdminSubNav";
import { getAdminUsage } from "@/lib/admin/get-usage";
import { isSupabaseDbEnabled } from "@/lib/auth/guards";
import { AdminUsageTable } from "./AdminUsageTable";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "יומן שימוש | ניהול | CourseFlow",
};

interface AdminUsagePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminUsagePage({ searchParams }: AdminUsagePageProps) {
  if (!isSupabaseDbEnabled()) {
    return (
      <DashboardShell title="יומן שימוש">
        <p className="text-sm" style={{ color: "var(--brand-text-muted)" }}>
          נדרש USE_SUPABASE_DB=true.
        </p>
      </DashboardShell>
    );
  }

  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "string" && v) qs.set(k, v);
  }
  if (!qs.has("page")) qs.set("page", "1");

  let data;
  try {
    data = await getAdminUsage({
      type: qs.get("type") || undefined,
      from: qs.get("from") || undefined,
      to: qs.get("to") || undefined,
      page: Number(qs.get("page") || "1"),
    });
  } catch {
    data = null;
  }

  const items = data?.items ?? [];

  return (
    <DashboardShell title="יומן שימוש" subtitle="אירועי יצירת באנר וקורסים">
      <AdminSubNav />

      {!data ? (
        <p className="text-sm" style={{ color: "var(--brand-text-muted)" }}>
          לא ניתן לטעון. ודא schema-admin.sql והרשאת אדמין.
        </p>
      ) : (
        <Suspense fallback={<p className="text-sm">טוען...</p>}>
          <AdminUsageTable
            items={items}
            page={data.page ?? 1}
            totalPages={data.totalPages ?? 1}
            total={data.total ?? 0}
          />
        </Suspense>
      )}
    </DashboardShell>
  );
}
