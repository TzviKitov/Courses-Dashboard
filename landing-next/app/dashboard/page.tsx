import { DashboardShell, CourseTile, DashboardFilters } from "@/components/dashboard";
import type { LandingsSummary } from "@/lib/supabase/types";

export const metadata = {
  title: "גלריית הכשרות | CourseFlow",
  description: "כל הקורסים וההכשרות הזמינים, עם סינון וחיפוש.",
};

export const dynamic = "force-dynamic";

interface DashboardPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function fetchLandings(
  params: URLSearchParams
): Promise<LandingsSummary[]> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  try {
    const r = await fetch(`${baseUrl}/api/landings?${params.toString()}`, {
      cache: "no-store",
    });
    if (!r.ok) return [];
    const data = await r.json();
    return data?.items || [];
  } catch (error) {
    console.error("Failed to fetch landings:", error);
    return [];
  }
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "string" && v) qs.set(k, v);
  }

  const items = await fetchLandings(qs);

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
