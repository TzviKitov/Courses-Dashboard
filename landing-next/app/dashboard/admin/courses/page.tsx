import { DashboardShell } from "@/components/dashboard";
import { AdminSubNav } from "@/components/dashboard/AdminSubNav";
import {
  ManagementRecordCard,
  RecordMeta,
  ResponsiveRecords,
  VisibilityBadge,
} from "@/components/dashboard/ResponsiveRecords";
import { CourseInstructorsAdmin } from "@/components/admin/CourseInstructorsAdmin";
import { getAdminLandings } from "@/lib/admin/get-landings";
import { isSupabaseDbEnabled } from "@/lib/auth/guards";
import { MyCoursesActions } from "@/app/dashboard/my/MyCoursesActions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "כל הקורסים | ניהול | CourseFlow",
};

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

  let items;
  try {
    items = await getAdminLandings();
  } catch {
    items = null;
  }

  return (
    <DashboardShell title="כל הקורסים" subtitle="עריכה ומחיקה לכל הקורסים בפלטפורמה">
      <AdminSubNav />

      {items === null ? (
        <p className="text-sm" style={{ color: "var(--brand-text-muted)" }}>
          לא ניתן לטעון קורסים.
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--brand-text-muted)" }}>
          אין קורסים.
        </p>
      ) : (
        <ResponsiveRecords
          cards={items.map((item) => (
            <ManagementRecordCard
              key={item.id}
              media={
                item.bannerThumbUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.bannerThumbUrl}
                    alt=""
                    className="w-16 h-12 object-cover rounded shrink-0"
                    loading="lazy"
                  />
                ) : null
              }
              title={
                <a
                  href={`/l/${item.id}`}
                  className="hover:underline hover-wiggle"
                  style={{ color: "var(--brand-text)" }}
                >
                  {item.title || "ללא כותרת"}
                </a>
              }
              subtitle={item.description}
              badge={<VisibilityBadge isPublic={item.isPublic} />}
              actions={
                <div className="w-full space-y-2">
                  <MyCoursesActions landingId={item.id} isPublic={item.isPublic} />
                  <CourseInstructorsAdmin landingId={item.id} />
                </div>
              }
            >
              <RecordMeta
                items={[
                  { label: "בעלים", value: item.ownerEmail },
                  { label: "תאריך", value: item.startDate || "—" },
                  { label: "לייקים", value: item.likesCount },
                  { label: "הרשמות", value: item.registrationsCount },
                  { label: "צפיות", value: item.viewsCount },
                ]}
              />
            </ManagementRecordCard>
          ))}
          table={
            <div
              className="overflow-x-auto rounded-2xl border"
              style={{ borderColor: "var(--brand-border)" }}
            >
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
                    <tr
                      key={item.id}
                      className="border-t"
                      style={{ borderColor: "var(--brand-border)" }}
                    >
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
                            <a
                              href={`/l/${item.id}`}
                              className="font-bold hover:underline hover-wiggle"
                              style={{ color: "var(--brand-text)" }}
                            >
                              {item.title || "ללא כותרת"}
                            </a>
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
                        <VisibilityBadge isPublic={item.isPublic} />
                      </td>
                      <td className="p-3 tabular-nums">{item.likesCount}</td>
                      <td className="p-3 tabular-nums">{item.registrationsCount}</td>
                      <td className="p-3 tabular-nums">{item.viewsCount}</td>
                      <td className="p-3">
                        <MyCoursesActions landingId={item.id} isPublic={item.isPublic} />
                        <CourseInstructorsAdmin landingId={item.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          }
        />
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
