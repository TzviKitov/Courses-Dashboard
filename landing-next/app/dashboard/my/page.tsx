import Link from "next/link";
import { headers } from "next/headers";
import { DashboardShell } from "@/components/dashboard";
import { assertPageAccess } from "@/lib/auth/guards";
import { getCurrentUser } from "@/lib/supabase/ssr";
import { getSupabaseAdmin, isSupabaseDbEnabled } from "@/lib/supabase/server";
import { MyCoursesActions } from "./MyCoursesActions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "הקורסים שלי | CourseFlow",
};

interface MyCourseRow {
  id: string;
  course: { title?: string; description?: string };
  assets: { bannerThumbUrl?: string };
  start_date: string | null;
  is_public: boolean;
  created_at: string;
  likes_count?: number;
}

export default async function MyDashboardPage() {
  if (!isSupabaseDbEnabled()) {
    return (
      <DashboardShell title="הקורסים שלי">
        <NotConfiguredNotice />
      </DashboardShell>
    );
  }

  const pathname = (await headers()).get("x-pathname") ?? "/dashboard/my";
  await assertPageAccess(pathname);

  const user = await getCurrentUser();
  if (!user) return null;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("landings_with_like_count")
    .select("id, course, assets, start_date, is_public, created_at, likes_count")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load my courses:", error);
  }

  const items = (data ?? []) as MyCourseRow[];

  return (
    <DashboardShell
      title="הקורסים שלי"
      subtitle={`מחובר כ-${user.email ?? "מדריך"}. כאן מוצגים רק הקורסים שיצרת.`}
      actions={
        <form action="/auth/sign-out" method="post">
          <button
            type="submit"
            className="px-3 py-2 text-xs font-medium rounded-md border"
            style={{
              borderColor: "var(--brand-border)",
              color: "var(--brand-text-muted)",
            }}
          >
            התנתק
          </button>
        </form>
      }
    >
      {items.length === 0 ? (
        <div
          className="rounded-2xl border p-10 text-center"
          style={{
            background: "var(--brand-surface)",
            borderColor: "var(--brand-border)",
          }}
        >
          <p className="text-sm mb-4" style={{ color: "var(--brand-text-muted)" }}>
            עדיין לא יצרת קורסים.
          </p>
          <Link
            href="/create"
            className="inline-block px-4 py-2 rounded-md text-white text-sm font-bold"
            style={{ background: "var(--brand-accent)" }}
          >
            צור קורס ראשון
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--brand-border)" }}>
          <table className="w-full text-sm" style={{ background: "var(--brand-surface)" }}>
            <thead style={{ background: "var(--brand-accent-soft)" }}>
              <tr>
                <Th>קורס</Th>
                <Th>תאריך פתיחה</Th>
                <Th>סטטוס</Th>
                <Th>לייקים</Th>
                <Th>פעולות</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t" style={{ borderColor: "var(--brand-border)" }}>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      {item.assets?.bannerThumbUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.assets.bannerThumbUrl}
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
                          {item.course?.title || "ללא כותרת"}
                        </Link>
                        <p
                          className="text-xs line-clamp-1"
                          style={{ color: "var(--brand-text-muted)" }}
                        >
                          {item.course?.description}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3" style={{ color: "var(--brand-text-muted)" }}>
                    {item.start_date || "—"}
                  </td>
                  <td className="p-3">
                    <span
                      className="px-2 py-0.5 rounded-full text-[11px] font-medium"
                      style={{
                        background: item.is_public
                          ? "var(--brand-accent-soft)"
                          : "#fff5ef",
                        color: item.is_public ? "var(--brand-accent)" : "#7a4a1d",
                      }}
                    >
                      {item.is_public ? "פעיל" : "מוסתר"}
                    </span>
                  </td>
                  <td className="p-3 tabular-nums" style={{ color: "var(--brand-text)" }}>
                    {item.likes_count ?? 0}
                  </td>
                  <td className="p-3">
                    <MyCoursesActions
                      landingId={item.id}
                      isPublic={item.is_public}
                    />
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
    <th
      className="p-3 text-right text-xs font-semibold"
      style={{ color: "var(--brand-accent)" }}
    >
      {children}
    </th>
  );
}

function NotConfiguredNotice() {
  return (
    <div
      className="rounded-2xl border p-8 text-center"
      style={{
        background: "var(--brand-surface)",
        borderColor: "var(--brand-border)",
      }}
    >
      <p className="text-sm mb-2" style={{ color: "var(--brand-text)" }}>
        ניהול מדריך דורש Supabase + USE_SUPABASE_DB=true.
      </p>
      <p className="text-xs" style={{ color: "var(--brand-text-muted)" }}>
        ראה SUPABASE_SETUP.md כדי להפעיל מסד נתונים ו-Auth.
      </p>
    </div>
  );
}
