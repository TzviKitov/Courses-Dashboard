import { DashboardShell } from "@/components/dashboard";
import { AdminSubNav } from "@/components/dashboard/AdminSubNav";
import { AdminAccountsPanel } from "@/components/admin/AdminAccountsPanel";
import { getAdminUsers } from "@/lib/admin/get-users";
import { isSupabaseDbEnabled } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "משתמשים | ניהול | CourseFlow",
};

interface AdminUserRow {
  ownerId: string;
  email: string;
  landingsCount: number;
  likesTotal: number;
  registrationsTotal: number;
  viewsTotal: number;
  bannerEventsTotal: number;
}

export default async function AdminUsersPage() {
  if (!isSupabaseDbEnabled()) {
    return (
      <DashboardShell title="משתמשים">
        <p className="text-sm" style={{ color: "var(--brand-text-muted)" }}>
          נדרש USE_SUPABASE_DB=true.
        </p>
      </DashboardShell>
    );
  }

  let activity: AdminUserRow[] | null;
  try {
    activity = await getAdminUsers();
  } catch {
    activity = null;
  }

  return (
    <DashboardShell
      title="משתמשים"
      subtitle="ניהול חשבונות, אישור מדריכים ו-Allowlist של Microsoft"
    >
      <AdminSubNav />

      <AdminAccountsPanel />

      <h2
        className="mt-12 mb-3 text-lg font-bold"
        style={{ color: "var(--brand-text)" }}
      >
        סיכום פעילות לפי יוצר (קיים)
      </h2>
      {activity === null ? (
        <p className="text-sm" style={{ color: "var(--brand-text-muted)" }}>
          לא ניתן לטעון נתוני פעילות.
        </p>
      ) : activity.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--brand-text-muted)" }}>
          אין נתונים.
        </p>
      ) : (
        <div
          className="overflow-x-auto rounded-2xl border"
          style={{ borderColor: "var(--brand-border)" }}
        >
          <table
            className="w-full text-sm"
            style={{ background: "var(--brand-surface)" }}
          >
            <thead style={{ background: "var(--brand-accent-soft)" }}>
              <tr>
                <th
                  className="p-3 text-right text-xs font-semibold"
                  style={{ color: "var(--brand-accent)" }}
                >
                  אימייל
                </th>
                <th
                  className="p-3 text-right text-xs font-semibold"
                  style={{ color: "var(--brand-accent)" }}
                >
                  קורסים
                </th>
                <th
                  className="p-3 text-right text-xs font-semibold"
                  style={{ color: "var(--brand-accent)" }}
                >
                  לייקים
                </th>
                <th
                  className="p-3 text-right text-xs font-semibold"
                  style={{ color: "var(--brand-accent)" }}
                >
                  הרשמות
                </th>
              </tr>
            </thead>
            <tbody>
              {activity.map((row) => (
                <tr
                  key={row.ownerId}
                  className="border-t"
                  style={{ borderColor: "var(--brand-border)" }}
                >
                  <td className="p-3 font-medium">{row.email}</td>
                  <td className="p-3 tabular-nums">{row.landingsCount}</td>
                  <td className="p-3 tabular-nums">{row.likesTotal}</td>
                  <td className="p-3 tabular-nums">{row.registrationsTotal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardShell>
  );
}
