import { Suspense } from "react";
import Link from "next/link";
import { InsightsCourseFilters, InsightsSummaryFilters } from "@/components/admin/InsightsFilters";
import { DashboardShell } from "@/components/dashboard";
import { AdminSubNav } from "@/components/dashboard/AdminSubNav";
import {
  ManagementRecordCard,
  RecordMeta,
  ResponsiveRecords,
} from "@/components/dashboard/ResponsiveRecords";
import {
  getTrainingInsights,
  sortCourseInsights,
  type CourseInsightRow,
  type CourseInsightSort,
} from "@/lib/admin/get-insights";
import { isSupabaseDbEnabled } from "@/lib/auth/guards";
import {
  SECTOR_OPTIONS,
  TARGET_AUDIENCE_OPTIONS,
} from "@/types/course";
import type { Sector, TargetAudienceTag } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "תובנות הכשרות",
};

const SORT_OPTIONS: { value: CourseInsightSort; label: string }[] = [
  { value: "views", label: "הנצפים ביותר" },
  { value: "registrants", label: "הכי הרבה נרשמים" },
  { value: "completion", label: "אחוזי סיום הגבוהים" },
  { value: "placement", label: "אחוזי השמה הגבוהים" },
  { value: "instructor", label: "לפי מדריך/ה" },
];

function pct(n: number | null): string {
  if (n === null) return "—";
  return `${Math.round(n * 100)}%`;
}

function isSort(value: string | undefined): value is CourseInsightSort {
  return SORT_OPTIONS.some((option) => option.value === value);
}

export default async function AdminInsightsPage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string;
    sector?: string;
    audience?: string;
    sort?: string;
    instructor?: string;
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
  const sort: CourseInsightSort = isSort(sp.sort) ? sp.sort : "views";
  const instructorOptions = insights
    ? [...new Map(insights.courses.map((course) => [course.instructorKey, course.instructorName])).entries()]
        .map(([key, name]) => ({ key, name }))
        .sort((a, b) => a.name.localeCompare(b.name, "he"))
    : [];
  const instructor = instructorOptions.some((option) => option.key === sp.instructor)
    ? sp.instructor!
    : "";
  const visibleCourses = insights
    ? sortCourseInsights(
        instructor
          ? insights.courses.filter((course) => course.instructorKey === instructor)
          : insights.courses,
        sort
      )
    : [];

  return (
    <DashboardShell
      title="תובנות הכשרות"
      subtitle="ניתוח קורסים, השמה ומדריכים לפי שנה / מגזר / קהל"
    >
      <AdminSubNav />

      <Suspense fallback={null}>
        <InsightsSummaryFilters
          year={year}
          years={years}
          sector={sector ?? ""}
          audience={audience ?? ""}
          sort={sort}
          instructor={instructor}
        />
      </Suspense>

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

          <CourseRanking
            year={year}
            sector={sector}
            audience={audience}
            sort={sort}
            instructor={instructor}
            instructorOptions={instructorOptions}
            courses={visibleCourses}
          />

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
            <div className="p-2">
              {insights.dominantInstructors.length === 0 ? (
                <p
                  className="p-4 text-center text-sm"
                  style={{ color: "var(--brand-text-muted)" }}
                >
                  אין נתונים לתקופה זו
                </p>
              ) : (
                <ResponsiveRecords
                  cards={insights.dominantInstructors.map((row) => (
                    <ManagementRecordCard
                      key={row.ownerId}
                      title={<span dir="ltr">{row.email}</span>}
                    >
                      <RecordMeta
                        items={[
                          { label: "קורסים", value: row.courses },
                          { label: "נרשמים", value: row.registrants },
                          { label: "השמות", value: row.placements },
                        ]}
                      />
                    </ManagementRecordCard>
                  ))}
                  table={
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
                        {insights.dominantInstructors.map((row) => (
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
                        ))}
                      </tbody>
                    </table>
                  }
                />
              )}
            </div>
          </section>

          <p className="mt-4 text-xs" style={{ color: "var(--brand-text-muted)" }}>
            שאלות נפוצות: אילו קורסים נפתחו השנה בתחום/מגזר — סננו למעלה. דירוג לפי צפיות,
            נרשמים, סיום או השמה — ברשימת הקורסים. מי מוביל בהשמה — טבלת המדריכים.
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
      className="management-card border p-5"
      style={{
        borderColor: "var(--brand-border)",
        background: "var(--brand-surface)",
        boxShadow: "var(--brand-shadow)",
      }}
    >
      <p className="text-sm font-medium mb-2" style={{ color: "var(--brand-text-muted)" }}>
        {label}
      </p>
      <p className="text-4xl leading-none font-bold tabular-nums" style={{ color: "var(--brand-text)" }}>
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

function CourseRanking({
  year,
  sector,
  audience,
  sort,
  instructor,
  instructorOptions,
  courses,
}: {
  year: number;
  sector?: Sector;
  audience?: TargetAudienceTag;
  sort: CourseInsightSort;
  instructor: string;
  instructorOptions: { key: string; name: string }[];
  courses: CourseInsightRow[];
}) {
  return (
    <section
      className="rounded-2xl border overflow-hidden mb-8"
      style={{
        borderColor: "var(--brand-border)",
        background: "var(--brand-surface)",
      }}
    >
      <div
        className="px-4 py-3 border-b flex flex-wrap items-end justify-between gap-3"
        style={{
          borderColor: "var(--brand-border)",
          background: "var(--brand-accent-soft)",
        }}
      >
        <div>
          <h2 className="text-sm font-semibold" style={{ color: "var(--brand-accent)" }}>
            רשימת הקורסים
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--brand-text-muted)" }}>
            {courses.length} קורסים
            {instructor ? " למדריך/ה שנבחר/ה" : ""}
          </p>
        </div>
        <Suspense fallback={null}>
          <InsightsCourseFilters
            year={year}
            sector={sector ?? ""}
            audience={audience ?? ""}
            sort={sort}
            instructor={instructor}
            instructorOptions={instructorOptions}
          />
        </Suspense>
      </div>
      <div className="p-2">
        {courses.length === 0 ? (
          <p className="p-4 text-center text-sm" style={{ color: "var(--brand-text-muted)" }}>
            אין קורסים לסינון הזה
          </p>
        ) : (
          <ResponsiveRecords
            cards={courses.map((course) => (
              <ManagementRecordCard
                key={course.id}
                title={<CourseTitle course={course} />}
                subtitle={course.instructorName}
              >
                <RecordMeta
                  items={[
                    { label: "צפיות", value: course.views },
                    { label: "נרשמים", value: course.registrants },
                    {
                      label: "אחוז סיום",
                      value: (
                        <RateValue
                          rate={course.completionRate}
                          numerator={course.completed}
                          denominator={course.registrants}
                        />
                      ),
                    },
                    {
                      label: "אחוז השמה",
                      value: (
                        <RateValue
                          rate={course.placementRate}
                          numerator={course.placed}
                          denominator={course.completed}
                        />
                      ),
                    },
                  ]}
                />
              </ManagementRecordCard>
            ))}
            table={
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <Th>קורס</Th>
                      <Th>מדריך/ה</Th>
                      <Th>צפיות</Th>
                      <Th>נרשמים</Th>
                      <Th>אחוז סיום</Th>
                      <Th>אחוז השמה</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {courses.map((course) => (
                      <tr
                        key={course.id}
                        className="border-t"
                        style={{ borderColor: "var(--brand-border)" }}
                      >
                        <td className="p-3">
                          <CourseTitle course={course} />
                          {course.startDate ? (
                            <p
                              className="text-xs mt-0.5 tabular-nums"
                              style={{ color: "var(--brand-text-muted)" }}
                            >
                              {course.startDate}
                            </p>
                          ) : null}
                        </td>
                        <td className="p-3" dir="auto">
                          {course.instructorName}
                        </td>
                        <td className="p-3 tabular-nums">{course.views}</td>
                        <td className="p-3 tabular-nums">{course.registrants}</td>
                        <td className="p-3">
                          <RateValue
                            rate={course.completionRate}
                            numerator={course.completed}
                            denominator={course.registrants}
                          />
                        </td>
                        <td className="p-3">
                          <RateValue
                            rate={course.placementRate}
                            numerator={course.placed}
                            denominator={course.completed}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            }
          />
        )}
      </div>
      <p
        className="px-4 py-2 text-xs border-t"
        style={{
          borderColor: "var(--brand-border)",
          color: "var(--brand-text-muted)",
        }}
      >
        אחוז סיום הוא מסיימים מתוך נרשמים פעילים. אחוז השמה הוא מושמים מתוך המסיימים.
        הרשמות שבוטלו לא נספרות.
      </p>
    </section>
  );
}

function CourseTitle({ course }: { course: CourseInsightRow }) {
  return (
    <a
      href={`/l/${course.id}`}
      className="font-bold hover:underline hover-wiggle"
      style={{ color: "var(--brand-text)" }}
    >
      {course.title}
    </a>
  );
}

function RateValue({
  rate,
  numerator,
  denominator,
}: {
  rate: number | null;
  numerator: number;
  denominator: number;
}) {
  return (
    <div>
      <div className="tabular-nums font-medium">{pct(rate)}</div>
      {denominator > 0 ? (
        <div className="text-xs tabular-nums" style={{ color: "var(--brand-text-muted)" }}>
          {numerator}/{denominator}
        </div>
      ) : null}
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
