import Link from "next/link";
import { DashboardShell } from "@/components/dashboard";
import { AdminSubNav } from "@/components/dashboard/AdminSubNav";
import { fetchAdminApi } from "@/lib/admin/fetch-admin";
import { isSupabaseDbEnabled } from "@/lib/auth/guards";
import { MyCoursesActions } from "@/app/dashboard/my/MyCoursesActions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "כל הקורסים | ניהול | CourseFlow",
};

interface AdminLandingRow {
  id: string;
  title: string;
  description: string;
  bannerThumbUrl?: string;
  startDate: string | null;
  isPublic: boolean;
  createdAt: string;
  ownerEmail: string;
  likesCount: number;
  registrationsCount: number;
  viewsCount: number;
}

export default async function AdminCoursesPage() {
  if (!isSupabaseDbEnabled()) {
    return (
      <DashboardShell title="כל הקורסים">
        <p className="text-sm" style={{ color: "var(--brand-text-muted)" }}>
          נדרש USE_SUPABASE_DB=true.
        </p>
      </DashboardShell>
    );
  }

  const data = await fetchAdminApi<{ items?: AdminLandingRow[] }>("/api/admin/landings");
  const items = data?.items ?? [];

  return (
    <DashboardShell title="כל הקורסים" subtitle="עריכה ומחיקה לכל הקורסים בפלטפורמה">
      <AdminSubNav />

      {items.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--brand-text-muted)" }}>
          אין קורסים או שאין הרשאת אדמין.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--brand-border)" }}>
          <table className="w-full text-sm" style={{ background: "var(--brand-surface)" }}>
            <thead style={{ background: "var(--brand-accent-soft)" }}>
              <tr>
                <Th>קורס</Th>
                <Th>בעלים</Th>
                <Th>תאריך</Th>
                <Th>סטטוס</Th>
                <Th>לייקים</Th>
                <Th>הרשמות</Th>
                <Th>צפיות</Th>
                <Th>פעולות</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t" style={{ borderColor: "var(--brand-border)" }}>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      {item.bannerThumbUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.bannerThumbUrl}
                          alt=""
                          className="w-14 h-10 object-cover rounded"
                          loading="lazy"
                        />
                      )}
                      <div>
                        <Link
                          href={`/l/${item.id}`}
                          className="font-bold hover:underline"
                          style={{ color: "var(--brand-text)" }}
                        >
                          {item.title || "ללא כותרת"}
                        </Link>
                        <p
                          className="text-xs line-clamp-1"
                          style={{ color: "var(--brand-text-muted)" }}
                        >
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-xs" style={{ color: "var(--brand-text-muted)" }}>
                    {item.ownerEmail}
                  </td>
                  <td className="p-3 text-xs" style={{ color: "var(--brand-text-muted)" }}>
                    {item.startDate || "—"}
                  </td>
                  <td className="p-3">
                    <span
                      className="px-2 py-0.5 rounded-full text-[11px] font-medium"
                      style={{
                        background: item.isPublic ? "var(--brand-accent-soft)" : "#fff5ef",
                        color: item.isPublic ? "var(--brand-accent)" : "#7a4a1d",
                      }}
                    >
                      {item.isPublic ? "פעיל" : "מוסתר"}
                    </span>
                  </td>
                  <td className="p-3 tabular-nums">{item.likesCount}</td>
                  <td className="p-3 tabular-nums">{item.registrationsCount}</td>
                  <td className="p-3 tabular-nums">{item.viewsCount}</td>
                  <td className="p-3">
                    <div className="flex flex-col items-end gap-1">
                      <a
                        href={`/api/landings/${item.id}/registrations?format=csv`}
                        className="text-xs font-medium underline"
                        style={{ color: "var(--brand-accent)" }}
                      >
                        נרשמים (CSV)
                      </a>
                      <MyCoursesActions landingId={item.id} isPublic={item.isPublic} />
                    </div>
                  </td>
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
