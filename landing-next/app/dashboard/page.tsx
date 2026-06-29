import { DashboardShell, CourseTile, DashboardFilters } from "@/components/dashboard";
import { listLandings } from "@/lib/landings/list-landings";
import type { Sector } from "@/lib/supabase/types";

export const metadata = {
  title: "גלריית הכשרות | CourseFlow",
  description: "כל הקורסים וההכשרות הזמינים, עם סינון וחיפוש.",
};

export const dynamic = "force-dynamic";

interface DashboardPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "string" && v) qs.set(k, v);
  }

  const items = await listLandings({
    audience: qs.get("audience") || undefined,
    sector: (qs.get("sector") as Sector | null) || undefined,
    from: qs.get("from") || undefined,
    to: qs.get("to") || undefined,
    maxPrice: qs.get("maxPrice") || undefined,
    sort: qs.get("sort") || "recent",
  });

  return (
    <DashboardShell
      title="גלריית הכשרות"
      subtitle="עיין בקורסים הפעילים, סנן לפי קהל יעד, מגזר ותאריך פתיחה, וסמן את האהובים עליך בלייק."
    >
      <DashboardFilters />

      {items.length === 0 ? (
        <EmptyState />
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

function EmptyState() {
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
        אין קורסים שתואמים לפילטרים
      </h2>
      <p className="text-sm" style={{ color: "var(--brand-text-muted)" }}>
        נסה לנקות את הסינונים או ליצור קורס חדש דרך הכפתור בכותרת.
      </p>
    </div>
  );
}
