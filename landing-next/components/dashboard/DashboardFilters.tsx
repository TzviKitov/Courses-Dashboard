"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import {
  filtersToFormState,
  hasActiveFiltersFromSearchParams,
  parseDashboardFilters,
} from "@/lib/dashboard/filter-params";
import {
  SECTOR_OPTIONS,
  TARGET_AUDIENCE_OPTIONS,
  type Sector,
  type TargetAudienceTag,
} from "@/types/course";

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "recent", label: "חדשים ביותר" },
  { value: "popular", label: "פופולריים" },
  { value: "starting_soon", label: "פותחים בקרוב" },
];

export function DashboardFilters() {
  const searchParams = useSearchParams();

  const current = useMemo(
    () => filtersToFormState(parseDashboardFilters(searchParams)),
    [searchParams]
  );

  const updateParam = useCallback((key: string, value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value === "") next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    window.location.assign(qs ? `/dashboard?${qs}` : "/dashboard");
  }, [searchParams]);

  const reset = useCallback(() => {
    window.location.assign("/dashboard");
  }, []);

  const hasActiveFilters = hasActiveFiltersFromSearchParams(searchParams);

  return (
    <div
      className="rounded-2xl border p-5 mb-8"
      style={{
        background: "var(--brand-surface)",
        borderColor: "var(--brand-border)",
        boxShadow: "var(--brand-shadow)",
      }}
    >
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold" style={{ color: "var(--brand-text-muted)" }}>
            קהל יעד
          </span>
          <select
            value={current.audience}
            onChange={(e) => updateParam("audience", e.target.value)}
            className="h-10 px-3 rounded-lg border bg-white text-sm outline-none focus:ring-2"
            style={{
              borderColor: "var(--brand-border)",
              color: "var(--brand-text)",
            }}
          >
            <option value="">כולם</option>
            {TARGET_AUDIENCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value as TargetAudienceTag}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold" style={{ color: "var(--brand-text-muted)" }}>
            מגזר
          </span>
          <select
            value={current.sector}
            onChange={(e) => updateParam("sector", e.target.value)}
            className="h-10 px-3 rounded-lg border bg-white text-sm outline-none"
            style={{
              borderColor: "var(--brand-border)",
              color: "var(--brand-text)",
            }}
          >
            <option value="">הכל</option>
            {SECTOR_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value as Sector}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold" style={{ color: "var(--brand-text-muted)" }}>
            פתיחה מ-
          </span>
          <input
            type="date"
            value={current.from}
            onChange={(e) => updateParam("from", e.target.value)}
            className="h-10 px-3 rounded-lg border bg-white text-sm outline-none"
            style={{
              borderColor: "var(--brand-border)",
              color: "var(--brand-text)",
            }}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold" style={{ color: "var(--brand-text-muted)" }}>
            מחיר מקסימלי (ש&quot;ח)
          </span>
          <input
            type="number"
            min={0}
            step={50}
            value={current.maxPrice}
            placeholder="ללא תקרה"
            onChange={(e) => updateParam("maxPrice", e.target.value)}
            className="h-10 px-3 rounded-lg border bg-white text-sm outline-none"
            style={{
              borderColor: "var(--brand-border)",
              color: "var(--brand-text)",
            }}
          />
        </label>
      </div>

      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-semibold"
            style={{ color: "var(--brand-text-muted)" }}
          >
            מיון:
          </span>
          {SORT_OPTIONS.map((opt) => {
            const isActive = current.sort === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => updateParam("sort", opt.value)}
                aria-pressed={isActive}
                className="px-3 h-8 rounded-full text-xs font-medium border transition-colors"
                style={{
                  background: isActive ? "var(--brand-accent)" : "transparent",
                  color: isActive ? "#fff" : "var(--brand-text)",
                  borderColor: isActive
                    ? "var(--brand-accent)"
                    : "var(--brand-border)",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={reset}
            className="text-xs font-medium underline-offset-2 hover:underline"
            style={{ color: "var(--brand-text-muted)" }}
          >
            נקה פילטרים
          </button>
        )}
      </div>
    </div>
  );
}
