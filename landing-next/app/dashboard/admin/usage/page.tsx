import { Suspense } from "react";
import { DashboardShell } from "@/components/dashboard";
import { AdminSubNav } from "@/components/dashboard/AdminSubNav";
import { fetchAdminApi } from "@/lib/admin/fetch-admin";
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

  const data = await fetchAdminApi<{
    items?: unknown[];
    page?: number;
    totalPages?: number;
    total?: number;
  }>(`/api/admin/usage?${qs.toString()}`);

  const items = (data?.items ?? []) as Parameters<typeof AdminUsageTable>[0]["items"];

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
