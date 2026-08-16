import Link from "next/link";
import { DashboardShell } from "@/components/dashboard";
import { AdminSubNav } from "@/components/dashboard/AdminSubNav";
import { getTrainingInsights } from "@/lib/admin/get-insights";
import { isSupabaseDbEnabled } from "@/lib/auth/guards";
import {
  SECTOR_OPTIONS,
  TARGET_AUDIENCE_OPTIONS,
} from "@/types/course";
import type { Sector, TargetAudienceTag } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "תובנות הכשרות | CourseFlow",
};

function pct(n: number | null): string {
  if (n === null) return "—";
  return `${Math.round(n * 100)}%`;
}

export default async function AdminInsightsPage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string;
    sector?: string;
    audience?: string;
  }>;
}) {
  if (!isSupabaseDbEnabled()) {
    return (
      <DashboardShell title="תובנות BI">
        <p className="text-sm" style={{ color: "var(--brand-text-muted)" }}>
          נדרש USE_SUPABASE_DB=true.
        </p>
      </DashboardShell>
    );
  }

  const sp = await searchParams;
  const year = sp.year ? Number(sp.year) : new Date().getFullYear();
  const sector = (SECTOR_OPTIONS.some((o) => o.value === sp.sector)
    ? sp.sector
    : undefined) as Sector | undefined;
  const audience = (TARGET_AUDIENCE_OPTIONS.some((o) => o.value === sp.audience)
    ? sp.audience
    : undefined) as TargetAudienceTag | undefined;

  let insights;
  try {
    insights = await getTrainingInsights({ year, sector, audience });
  } catch (e) {
    console.error(e);
    insights = null;
  }

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  return (
    <DashboardShell
      title="תובנות הכשרות"
      subtitle="ניתוח קורסים, השמה ומדריכים לפי שנה / מגזר / קהל"
    >
      <AdminSubNav />

      <form className="flex flex-wrap gap-3 mb-8 items-end">
        <label className="text-xs">
          <span className="block mb-1" style={{ color: "var(--brand-text-muted)" }}>
            שנה
          </span>
          <select
            name="year"
            defaultValue={String(year)}
            className="border rounded-md px-2 py-1.5 text-sm"
            style={{ borderColor: "var(--brand-border)" }}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          <span className="block mb-1" style={{ color: "var(--brand-text-muted)" }}>
            מגזר
          </span>
          <select
            name="sector"
            defaultValue={sector ?? ""}
            className="border rounded-md px-2 py-1.5 text-sm"
            style={{ borderColor: "var(--brand-border)" }}
          >
            <option value="">הכל</option>
            {SECTOR_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          <span className="block mb-1" style={{ color: "var(--brand-text-muted)" }}>
            קהל יעד
          </span>
          <select
            name="audience"
            defaultValue={audience ?? ""}
            className="border rounded-md px-2 py-1.5 text-sm"
            style={{ borderColor: "var(--brand-border)" }}
          >
            <option value="">הכל</option>
            {TARGET_AUDIENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="px-3 py-1.5 text-sm font-bold rounded-md text-white hover-nudge"
          style={{ background: "var(--brand-accent)" }}
        >
          סנן
        </button>
      </form>

      {!insights ? (
        <p className="text-sm" style={{ color: "var(--brand-text-muted)" }}>
          לא ניתן לטעון תובנות. ודא שהרצת db/schema-followups.sql.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Kpi label="קורסים שנפתחו" value={insights.coursesOpened} />
            <Kpi label="סיימו" value={insights.completedCount} />
            <Kpi label="הושמו" value={insights.placedCount} />
            <Kpi label="שיעור השמה" value={pct(insights.placementRate)} />
            <Kpi label="מילוי טופס 1" value={pct(insights.formFillRates.form1)} />
            <Kpi label="מילוי טופס 2" value={pct(insights.formFillRates.form2)} />
            <Kpi label="מילוי טופס 3" value={pct(insights.formFillRates.form3)} />
            <Kpi label="תזכורות ממתינות" value={insights.pendingReminders} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <SimpleTable
              title="לפי מגזר"
              rows={insights.bySector.map((r) => [
                SECTOR_OPTIONS.find((o) => o.value === r.sector)?.label || r.sector,
                String(r.count),
              ])}
            />
            <SimpleTable
              title="לפי קהל יעד"
              rows={insights.byAudience.map((r) => [
                TARGET_AUDIENCE_OPTIONS.find((o) => o.value === r.tag)?.label || r.tag,
                String(r.count),
              ])}
            />
          </div>

          <section
            className="rounded-2xl border overflow-hidden"
            style={{
              borderColor: "var(--brand-border)",
              background: "var(--brand-surface)",
            }}
          >
            <div
              className="px-4 py-2 text-xs font-semibold border-b"
              style={{
                borderColor: "var(--brand-border)",
                color: "var(--brand-accent)",
                background: "var(--brand-accent-soft)",
              }}
            >
              מדריכים דומיננטיים
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <Th>מדריך</Th>
                    <Th>קורסים</Th>
                    <Th>נרשמים</Th>
                    <Th>השמות</Th>
                  </tr>
                </thead>
                <tbody>
                  {insights.dominantInstructors.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="p-4 text-center"
                        style={{ color: "var(--brand-text-muted)" }}
                      >
                        אין נתונים לתקופה זו
                      </td>
                    </tr>
                  ) : (
                    insights.dominantInstructors.map((row) => (
                      <tr
                        key={row.ownerId}
                        className="border-t"
                        style={{ borderColor: "var(--brand-border)" }}
                      >
                        <td className="p-3">{row.email}</td>
                        <td className="p-3 tabular-nums">{row.courses}</td>
                        <td className="p-3 tabular-nums">{row.registrants}</td>
                        <td className="p-3 tabular-nums">{row.placements}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <p className="mt-4 text-xs" style={{ color: "var(--brand-text-muted)" }}>
            שאלות נפוצות: אילו קורסים נפתחו השנה בתחום/מגזר — סננו למעלה. מי מוביל בהשמה —
            טבלת המדריכים. אחוזי מילוי טפסים — כרטיסי ה-KPI.
          </p>
          <Link
            href="/dashboard/admin/courses"
            className="inline-block mt-2 text-xs underline hover-wiggle"
            style={{ color: "var(--brand-accent)" }}
          >
            לרשימת כל הקורסים
          </Link>
        </>
      )}
    </DashboardShell>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
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

function SimpleTable({ title, rows }: { title: string; rows: string[][] }) {
  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ borderColor: "var(--brand-border)", background: "var(--brand-surface)" }}
    >
      <div
        className="px-4 py-2 text-xs font-semibold border-b"
        style={{
          borderColor: "var(--brand-border)",
          color: "var(--brand-accent)",
          background: "var(--brand-accent-soft)",
        }}
      >
        {title}
      </div>
      <table className="w-full text-sm">
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="p-4 text-center" style={{ color: "var(--brand-text-muted)" }}>
                —
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i} className="border-t" style={{ borderColor: "var(--brand-border)" }}>
                <td className="p-3">{r[0]}</td>
                <td className="p-3 text-left tabular-nums">{r[1]}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
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
