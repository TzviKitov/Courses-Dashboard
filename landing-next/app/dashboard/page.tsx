import { Suspense } from "react";
import { connection } from "next/server";
import { DashboardShell, CourseTile, DashboardFilters } from "@/components/dashboard";
import {
  filtersToListParams,
  hasContentFilters,
  parseDashboardFilters,
} from "@/lib/dashboard/filter-params";
import { listLandings } from "@/lib/landings/list-landings";

export const metadata = {
  title: "גלריית הכשרות | CourseFlow",
  description: "כל הקורסים וההכשרות הזמינים, עם סינון וחיפוש.",
};

export const dynamic = "force-dynamic";

interface DashboardPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  await connection();

  const params = await searchParams;
  const filters = parseDashboardFilters(params);
  const { items, error } = await listLandings(filtersToListParams(filters));

  if (process.env.NODE_ENV === "development") {
    console.log("[dashboard] listLandings:", {
      count: items.length,
      error,
      filters: filtersToListParams(filters),
    });
  }

  const filtered = hasContentFilters(filters);

  return (
    <DashboardShell
      title="גלריית הכשרות"
      subtitle="עיין בקורסים הפעילים, סנן לפי קהל יעד, מגזר ותאריך פתיחה, וסמן את האהובים עליך בלייק."
    >
      <Suspense fallback={<FiltersSkeleton />}>
        <DashboardFilters />
      </Suspense>

      {error ? (
        <ErrorState message={error} />
      ) : items.length === 0 ? (
        <EmptyState filtered={filtered} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => (
            <CourseTile key={item.id} item={item} />
          ))}
        </div>
      )}
    </DashboardShell>
  );
}

function FiltersSkeleton() {
  return (
    <div
      className="rounded-2xl border p-5 mb-8 animate-pulse"
      style={{
        background: "var(--brand-surface)",
        borderColor: "var(--brand-border)",
      }}
    >
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="h-10 rounded-lg bg-gray-100" />
        ))}
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div
      className="rounded-2xl border p-10 text-center"
      style={{
        background: "var(--brand-surface)",
        borderColor: "var(--brand-border)",
      }}
    >
      <h2 className="text-lg font-bold mb-1" style={{ color: "var(--brand-text)" }}>
        שגיאה בטעינת הקורסים
      </h2>
      <p className="text-sm" style={{ color: "var(--brand-text-muted)" }}>
        {message}
      </p>
    </div>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div
      className="rounded-2xl border p-10 text-center"
      style={{
        background: "var(--brand-surface)",
        borderColor: "var(--brand-border)",
        boxShadow: "var(--brand-shadow)",
      }}
    >
      <div
        className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center"
        style={{ background: "var(--brand-accent-soft)" }}
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: 28, color: "var(--brand-accent)" }}
        >
          school
        </span>
      </div>
      <h2
        className="text-lg font-bold mb-1"
        style={{ color: "var(--brand-text)" }}
      >
        {filtered ? "אין קורסים שתואמים לפילטרים" : "אין קורסים פעילים כרגע"}
      </h2>
      <p className="text-sm mb-4" style={{ color: "var(--brand-text-muted)" }}>
        {filtered
          ? "נסה לנקות את הסינונים או לשנות את הקריטריונים."
          : "כשיווצרו קורסים חדשים הם יופיעו כאן. אפשר גם ליצור קורס דרך הכפתור בכותרת."}
      </p>
      {filtered && (
        <a
          href="/dashboard"
          className="inline-block text-sm font-medium underline-offset-2 hover:underline"
          style={{ color: "var(--brand-accent)" }}
        >
          נקה פילטרים
        </a>
      )}
    </div>
  );
}
