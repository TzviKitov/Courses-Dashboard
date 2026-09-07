import { Suspense } from "react";
import { connection } from "next/server";
import {
  DashboardShell,
  CourseTile,
  DashboardFilters,
  SupportBanner,
} from "@/components/dashboard";
import {
  dashboardHref,
  filtersToListParams,
  hasActiveFilters,
  hasActiveSearch,
  parseDashboardFilters,
} from "@/lib/dashboard/filter-params";
import { listLandings } from "@/lib/landings/list-landings";
import { getLikedLandingIds } from "@/lib/landings/liked-ids";

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

  const searchActive = hasActiveSearch(filters);
  const filtersActive = hasActiveFilters(filters);
  const likedIds = error
    ? new Set<string>()
    : await getLikedLandingIds(items.map((i) => i.id));

  return (
    <DashboardShell
      theme="public"
      title="גלריית הכשרות"
      subtitle="מגלים קורסים, סדנאות והזדמנויות חדשות ברחבי ירושלים."
    >
      <Suspense fallback={<FiltersSkeleton />}>
        <DashboardFilters />
      </Suspense>

      {searchActive && (
        <p
          className="mb-4 text-base flex items-center gap-3 flex-wrap"
          style={{ color: "var(--brand-text-muted)" }}
        >
          <span>תוצאות חיפוש: {filters.q}</span>
          <a
            href={dashboardHref(filters, { search: false, filters: true })}
            className="text-sm font-medium underline-offset-4 hover:underline hover-wiggle"
            style={{ color: "var(--brand-accent)" }}
          >
            נקה חיפוש
          </a>
        </p>
      )}

      {error ? (
        <ErrorState message={error} />
      ) : items.length === 0 ? (
        <EmptyState
          hasSearch={searchActive}
          hasFilters={filtersActive}
          clearSearchHref={dashboardHref(filters, { search: false, filters: true })}
          clearFiltersHref={dashboardHref(filters, { search: true, filters: false })}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 items-stretch">
          {items.map((item) => (
            <CourseTile
              key={item.id}
              item={item}
              initialLiked={likedIds.has(item.id)}
            />
          ))}
        </div>
      )}

      <SupportBanner />
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
      <div className="h-5 w-28 rounded bg-gray-100 mb-4" />
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

function EmptyState({
  hasSearch,
  hasFilters,
  clearSearchHref,
  clearFiltersHref,
}: {
  hasSearch: boolean;
  hasFilters: boolean;
  clearSearchHref: string;
  clearFiltersHref: string;
}) {
  const narrowed = hasSearch || hasFilters;
  const title = hasSearch && hasFilters
    ? "אין קורסים שתואמים לחיפוש או לפילטרים"
    : hasSearch
      ? "אין קורסים שתואמים לחיפוש"
      : hasFilters
        ? "אין קורסים שתואמים לפילטרים"
        : "אין קורסים פעילים כרגע";
  const hint = hasSearch && hasFilters
    ? "נסו מילת חיפוש אחרת, או שנו את הסינונים — כל אחד בנפרד."
    : hasSearch
      ? "נסו מילת חיפוש אחרת, או נקו את החיפוש."
      : hasFilters
        ? "נסו לשנות את הסינונים, או נקו את הפילטרים."
        : "כשיווצרו קורסים חדשים הם יופיעו כאן. אפשר גם ליצור קורס דרך הכפתור בכותרת.";
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
        {title}
      </h2>
      <p className="text-sm mb-4" style={{ color: "var(--brand-text-muted)" }}>
        {hint}
      </p>
      {narrowed && (
        <div className="flex items-center justify-center gap-4 flex-wrap">
          {hasSearch && (
            <a
              href={clearSearchHref}
              className="inline-block text-sm font-medium underline-offset-4 hover:underline hover-wiggle"
              style={{ color: "var(--brand-accent)" }}
            >
              נקה חיפוש
            </a>
          )}
          {hasFilters && (
            <a
              href={clearFiltersHref}
              className="inline-block text-sm font-medium underline-offset-4 hover:underline hover-wiggle"
              style={{ color: "var(--brand-accent)" }}
            >
              נקה פילטרים
            </a>
          )}
        </div>
      )}
    </div>
  );
}
