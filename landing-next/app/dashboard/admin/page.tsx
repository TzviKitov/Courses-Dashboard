import { DashboardShell } from "@/components/dashboard";
import { AdminBarChart } from "@/components/dashboard/AdminBarChart";
import { AdminSubNav } from "@/components/dashboard/AdminSubNav";
import { fetchAdminApi } from "@/lib/admin/fetch-admin";
import { isSupabaseDbEnabled } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "ניהול מערכת | CourseFlow",
};

interface AdminStats {
  totalLandings: number;
  uniqueCreators: number;
  totalLikes: number;
  totalRegistrations: number;
  viewsLast7Days: number;
  viewsLast30Days: number;
  bannerEventsLast7Days: number;
  bannerEventsLast30Days: number;
  viewsByDay: { date: string; count: number }[];
  registrationsByDay: { date: string; count: number }[];
}

async function fetchStats(): Promise<AdminStats | null> {
  const data = await fetchAdminApi<{ stats?: AdminStats }>("/api/admin/stats");
  return data?.stats ?? null;
}

function KpiCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div
      className="rounded-2xl border p-4"
      style={{ borderColor: "var(--brand-border)", background: "var(--brand-surface)" }}
    >
      <p className="text-xs mb-1" style={{ color: "var(--brand-text-muted)" }}>
        {label}
      </p>
      <p className="text-2xl font-bold tabular-nums" style={{ color: "var(--brand-text)" }}>
        {value}
      </p>
    </div>
  );
}

export default async function AdminOverviewPage() {
  if (!isSupabaseDbEnabled()) {
    return (
      <DashboardShell title="ניהול מערכת">
        <p className="text-sm" style={{ color: "var(--brand-text-muted)" }}>
          נדרש USE_SUPABASE_DB=true. ראה SUPABASE_SETUP.md.
        </p>
      </DashboardShell>
    );
  }

  const stats = await fetchStats();

  return (
    <DashboardShell
      title="ניהול מערכת"
      subtitle="סקירת פעילות, קורסים ושימוש בפלטפורמה"
    >
      <AdminSubNav />

      {!stats ? (
        <p className="text-sm" style={{ color: "var(--brand-text-muted)" }}>
          לא ניתן לטעון נתונים. ודא שהרצת schema-admin.sql ושאתה מחובר כאדמין.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <KpiCard label="סה״כ קורסים" value={stats.totalLandings} />
            <KpiCard label="יוצרים" value={stats.uniqueCreators} />
            <KpiCard label="לייקים" value={stats.totalLikes} />
            <KpiCard label="הרשמות" value={stats.totalRegistrations} />
            <KpiCard label="צפיות (7 ימים)" value={stats.viewsLast7Days} />
            <KpiCard label="צפיות (30 יום)" value={stats.viewsLast30Days} />
            <KpiCard label="אירועי באנר (7 ימים)" value={stats.bannerEventsLast7Days} />
            <KpiCard label="אירועי באנר (30 יום)" value={stats.bannerEventsLast30Days} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AdminBarChart title="צפיות — 7 ימים אחרונים" data={stats.viewsByDay} />
            <AdminBarChart title="הרשמות — 7 ימים אחרונים" data={stats.registrationsByDay} />
          </div>
        </>
      )}
    </DashboardShell>
  );
}
