import { DashboardShell } from "@/components/dashboard";
import { AdminSubNav } from "@/components/dashboard/AdminSubNav";
import { AdminLogosPanel } from "@/components/admin/AdminLogosPanel";
import { isSupabaseDbEnabled } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "לוגואים | ניהול | CourseFlow",
};

export default function AdminLogosPage() {
  if (!isSupabaseDbEnabled()) {
    return (
      <DashboardShell title="לוגואים">
        <p className="text-sm" style={{ color: "var(--brand-text-muted)" }}>
          נדרש USE_SUPABASE_DB=true.
        </p>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title="לוגואים"
      subtitle="ניהול הספרייה שיוצרי קורסים בוחרים ממנה לוגואים לבאנר ולדף הנחיתה"
    >
      <AdminSubNav />
      <AdminLogosPanel />
    </DashboardShell>
  );
}
