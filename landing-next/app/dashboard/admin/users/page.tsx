import { DashboardShell } from "@/components/dashboard";
import { AdminSubNav } from "@/components/dashboard/AdminSubNav";
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

  let items: AdminUserRow[] | null;
  try {
    items = await getAdminUsers();
  } catch {
    items = null;
  }

  return (
    <DashboardShell title="משתמשים" subtitle="סיכום פעילות לפי יוצר">
      <AdminSubNav />

      {items === null ? (
        <p className="text-sm" style={{ color: "var(--brand-text-muted)" }}>
          לא ניתן לטעון נתונים.
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--brand-text-muted)" }}>
          אין נתונים או שאין הרשאת אדמין.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--brand-border)" }}>
          <table className="w-full text-sm" style={{ background: "var(--brand-surface)" }}>
            <thead style={{ background: "var(--brand-accent-soft)" }}>
              <tr>
                <Th>אימייל</Th>
                <Th>קורסים</Th>
                <Th>לייקים</Th>
                <Th>הרשמות</Th>
                <Th>צפיות</Th>
                <Th>אירועי באנר</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.ownerId} className="border-t" style={{ borderColor: "var(--brand-border)" }}>
                  <td className="p-3 font-medium" style={{ color: "var(--brand-text)" }}>
                    {row.email}
                  </td>
                  <td className="p-3 tabular-nums">{row.landingsCount}</td>
                  <td className="p-3 tabular-nums">{row.likesTotal}</td>
                  <td className="p-3 tabular-nums">{row.registrationsTotal}</td>
                  <td className="p-3 tabular-nums">{row.viewsTotal}</td>
                  <td className="p-3 tabular-nums">{row.bannerEventsTotal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardShell>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="p-3 text-right text-xs font-semibold" style={{ color: "var(--brand-accent)" }}>
      {children}
    </th>
  );
}
