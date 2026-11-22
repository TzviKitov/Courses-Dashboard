import { Suspense } from "react";
import { connection } from "next/server";
import {
  DashboardShell,
  DashboardFilters,
  SupportBanner,
} from "@/components/dashboard";
import { PreserveViewLink } from "@/components/navigation/PreserveViewLink";
import { BulkCourseGallery } from "@/components/dashboard/BulkCourseGallery";
import { WallDivider } from "@/components/ui/brand";
import { BrandMark } from "@/components/ui/BrandMark";
import {
  dashboardHref,
  filtersToListParams,
  hasActiveFilters,
  hasActiveSearch,
  parseDashboardFilters,
} from "@/lib/dashboard/filter-params";
import { listLandings } from "@/lib/landings/list-landings";
import { getLikedLandingIds } from "@/lib/landings/liked-ids";
import { isAdmin } from "@/lib/auth/admin";
import { getCurrentUser } from "@/lib/supabase/ssr";
import { getSupabaseAdmin, isSupabaseDbEnabled } from "@/lib/supabase/server";

export const metadata = {
  title: "גלריית קורסים, קבוצות ואירועים",
  description: "כל הקורסים, הקבוצות והאירועים הזמינים, עם סינון וחיפוש.",
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
  const manageableIds = error ? [] : await getGalleryManageableIds(items.map((i) => i.id));

  return (
    <DashboardShell
      theme="public"
      title="גלריית קורסים, קבוצות ואירועים"
      subtitle="מגלים קורסים, סדנאות והזדמנויות חדשות."
    >
      <div className="px-4 sm:px-6">
      <Suspense fallback={<FiltersSkeleton />}>
        <DashboardFilters />
      </Suspense>
      </div>

      <WallDivider />

      {searchActive && (
        <p
          className="px-4 sm:px-6 mt-4 text-base flex items-center gap-3 flex-wrap"
          style={{ color: "var(--color-text-muted)" }}
        >
          <span>תוצאות חיפוש: {filters.q}</span>
          <PreserveViewLink
            href={dashboardHref(filters, { search: false, filters: true })}
            fallbackFocus="gallery-search"
            className="text-sm font-medium underline-offset-4 hover:underline hover-wiggle"
            style={{ color: "var(--brand-accent)" }}
          >
            נקה חיפוש
          </PreserveViewLink>
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
        <BulkCourseGallery
          items={items}
          likedIds={[...likedIds]}
          manageableIds={manageableIds}
        />
      )}

      <SupportBanner />
    </DashboardShell>
  );
}

async function getGalleryManageableIds(visibleIds: string[]): Promise<string[]> {
  if (!isSupabaseDbEnabled() || visibleIds.length === 0) return [];

  const user = await getCurrentUser();
  if (!user) return [];
  if (isAdmin(user)) return visibleIds;

  const { data, error } = await getSupabaseAdmin()
    .from("landings")
    .select("id")
    .eq("owner_id", user.id)
    .in("id", visibleIds);

  if (error) {
    console.error("[dashboard] failed to resolve manageable courses:", error);
    return [];
  }

  return (data ?? []).map((row: { id: string }) => row.id);
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
      <BrandMark className="av-empty-mark" />
      <h2
        className="text-lg font-bold mb-1"
        style={{ color: "var(--brand-text)" }}
      >
        {title}
      </h2>
      <p className="text-sm mb-4" style={{ color: "var(--brand-text-muted)" }}>
        {hint}
      </p>
      {!narrowed && (
        <PreserveViewLink
          href="/dashboard?availability=all"
          className="inline-block text-sm font-medium underline-offset-4 hover:underline hover-wiggle"
          style={{ color: "var(--brand-accent)" }}
        >
          הצגת גם קורסים שהסתיימו
        </PreserveViewLink>
      )}
      {narrowed && (
        <div className="flex items-center justify-center gap-4 flex-wrap">
          {hasSearch && (
            <PreserveViewLink
              href={clearSearchHref}
              fallbackFocus="gallery-search"
              className="inline-block text-sm font-medium underline-offset-4 hover:underline hover-wiggle"
              style={{ color: "var(--brand-accent)" }}
            >
              נקה חיפוש
            </PreserveViewLink>
          )}
          {hasFilters && (
            <PreserveViewLink
              href={clearFiltersHref}
              fallbackFocus="gallery-search"
              className="inline-block text-sm font-medium underline-offset-4 hover:underline hover-wiggle"
              style={{ color: "var(--brand-accent)" }}
            >
              נקה פילטרים
            </PreserveViewLink>
          )}
        </div>
      )}
    </div>
  );
}
