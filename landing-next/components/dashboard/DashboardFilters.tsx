"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import {
  filtersToFormState,
  hasActiveFiltersFromSearchParams,
  parseDashboardFilters,
} from "@/lib/dashboard/filter-params";
import {
  AUDIENCE_CATEGORY_OPTIONS,
  AVAILABILITY_FILTER_OPTIONS,
  COURSE_TYPE_OPTIONS,
  GENDER_SEPARATION_OPTIONS,
  SECTOR_OPTIONS,
} from "@/types/course";

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "recent", label: "חדשים ביותר" },
  { value: "popular", label: "פופולריים" },
  { value: "starting_soon", label: "פותחים בקרוב" },
];

const selectClassName =
  "h-10 px-3 rounded-lg border bg-white text-sm outline-none focus:ring-2";
const selectStyle = {
  borderColor: "var(--brand-border)",
  color: "var(--brand-text)",
} as const;

export function DashboardFilters() {
  const searchParams = useSearchParams();

  const current = useMemo(
    () => filtersToFormState(parseDashboardFilters(searchParams)),
    [searchParams]
  );

  const hasSecondaryFilters =
    Boolean(current.availability) ||
    Boolean(current.maxPrice) ||
    current.sort !== "recent";

  const [expanded, setExpanded] = useState(hasSecondaryFilters);

  const navigate = useCallback((next: URLSearchParams) => {
    const qs = next.toString();
    window.location.assign(qs ? `/dashboard?${qs}` : "/dashboard");
  }, []);

  const updateParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(searchParams.toString());
      if (value === "") next.delete(key);
      else next.set(key, value);
      navigate(next);
    },
    [navigate, searchParams]
  );

  const updateAvailability = useCallback(
    (value: string) => {
      const next = new URLSearchParams(searchParams.toString());
      if (value === "") {
        next.delete("availability");
        next.delete("from");
      } else {
        next.set("availability", value);
        if (value !== "open_from") next.delete("from");
      }
      navigate(next);
    },
    [navigate, searchParams]
  );

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
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2
          className="text-base font-bold"
          style={{ color: "var(--brand-text)" }}
        >
          סינון ומיון
        </h2>
        <div className="flex items-center gap-3">
          {hasActiveFilters && (
            <button
              type="button"
              onClick={reset}
              className="text-xs font-medium underline-offset-4 hover:underline cursor-pointer hover-wiggle"
              style={{ color: "var(--brand-text-muted)" }}
            >
              נקה פילטרים
            </button>
          )}
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            aria-expanded={expanded}
            className="inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer hover-nudge"
            style={{ color: "var(--brand-accent)" }}
          >
            {expanded ? "פחות אפשרויות" : "עוד אפשרויות"}
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              style={{
                transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s ease",
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold" style={{ color: "var(--brand-text-muted)" }}>
            קהל יעד
          </span>
          <select
            value={current.audience}
            onChange={(e) => updateParam("audience", e.target.value)}
            className={selectClassName}
            style={selectStyle}
          >
            <option value="">כולם</option>
            {AUDIENCE_CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.tag}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold" style={{ color: "var(--brand-text-muted)" }}>
            מגדר
          </span>
          <select
            value={current.gender}
            onChange={(e) => updateParam("gender", e.target.value)}
            className={selectClassName}
            style={selectStyle}
          >
            <option value="">הכל</option>
            {GENDER_SEPARATION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold" style={{ color: "var(--brand-text-muted)" }}>
            סוג קורס
          </span>
          <select
            value={current.courseType}
            onChange={(e) => updateParam("courseType", e.target.value)}
            className={selectClassName}
            style={selectStyle}
          >
            <option value="">הכל</option>
            {COURSE_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
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
            className={selectClassName}
            style={selectStyle}
          >
            <option value="">הכל</option>
            {SECTOR_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {expanded && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold" style={{ color: "var(--brand-text-muted)" }}>
                סטטוס פתיחה
              </span>
              <select
                value={current.availability}
                onChange={(e) => updateAvailability(e.target.value)}
                className={selectClassName}
                style={selectStyle}
              >
                <option value="">הכל</option>
                {AVAILABILITY_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            {current.availability === "open_from" && (
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold" style={{ color: "var(--brand-text-muted)" }}>
                  פתוחים מ-
                </span>
                <input
                  type="date"
                  value={current.from}
                  onChange={(e) => updateParam("from", e.target.value)}
                  className={selectClassName}
                  style={selectStyle}
                />
              </label>
            )}

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
                className={selectClassName}
                style={selectStyle}
              />
            </label>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
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
                  className="px-3 h-8 rounded-full text-xs font-medium border cursor-pointer hover-chip hover-nudge"
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
        </div>
      )}
    </div>
  );
}
