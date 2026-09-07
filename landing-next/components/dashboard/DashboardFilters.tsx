"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  dashboardHref,
  filtersToFormState,
  hasActiveFiltersFromSearchParams,
  parseDashboardFilters,
  sanitizeSearchQuery,
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
  "min-h-12 px-3 rounded-xl border bg-white text-base outline-none focus:ring-2";
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

  const resetFilters = useCallback(() => {
    window.location.assign(dashboardHref(parseDashboardFilters(searchParams), {
      search: true,
      filters: false,
    }));
  }, [searchParams]);

  const hasActiveFilters = hasActiveFiltersFromSearchParams(searchParams);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [queryDraft, setQueryDraft] = useState(current.q);

  const applySearch = useCallback(
    (value: string) => {
      const next = new URLSearchParams(searchParams.toString());
      const cleaned = sanitizeSearchQuery(value);
      if (!cleaned) next.delete("q");
      else next.set("q", cleaned);
      navigate(next);
    },
    [navigate, searchParams]
  );

  useEffect(() => {
    if (!sheetOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSheetOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [sheetOpen]);

  const filterFields = (
    <>
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
    </>
  );

  const secondaryFields = (
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
              className="px-4 min-h-12 rounded-full text-sm font-medium border cursor-pointer hover-chip hover-nudge"
              style={{
                background: isActive ? "var(--brand-accent)" : "transparent",
                color: isActive
                  ? "var(--brand-accent-contrast)"
                  : "var(--brand-text)",
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
  );

  const searchBar = (
    <form
      className="mb-4"
      method="get"
      action="/dashboard"
      onSubmit={(event) => {
        event.preventDefault();
        applySearch(queryDraft);
      }}
    >
      {Array.from(searchParams.entries())
        .filter(([key]) => key !== "q")
        .map(([key, value]) => (
          <input key={`${key}=${value}`} type="hidden" name={key} value={value} />
        ))}
      <label className="flex flex-col gap-1.5">
        <span className="sr-only">חיפוש קורס</span>
        <div className="flex gap-2">
          <div
            className="search-field flex flex-1 min-h-12 items-center rounded-xl border bg-white"
            style={selectStyle}
          >
            <span
              className="material-symbols-outlined shrink-0 px-3"
              style={{ color: "var(--brand-text-muted)", fontSize: 22 }}
              aria-hidden
            >
              search
            </span>
            <input
              type="text"
              name="q"
              value={queryDraft}
              onChange={(event) => setQueryDraft(event.target.value)}
              placeholder="חיפוש לפי שם, תיאור או מיקום"
              maxLength={80}
              enterKeyHint="search"
              className="min-h-12 flex-1 min-w-0 bg-transparent text-base outline-none"
              style={{ color: "var(--brand-text)" }}
            />
            {queryDraft ? (
              <button
                type="button"
                aria-label="נקה חיפוש"
                onClick={() => {
                  setQueryDraft("");
                  if (current.q) applySearch("");
                }}
                className="shrink-0 min-h-12 min-w-12 inline-flex items-center justify-center rounded-md hover-nudge"
                style={{ color: "var(--brand-text-muted)" }}
              >
                <span className="material-symbols-outlined" aria-hidden>
                  close
                </span>
              </button>
            ) : null}
          </div>
          <button
            type="submit"
            className="min-h-12 px-4 rounded-xl text-base font-bold shrink-0 hover-nudge"
            style={{
              background: "var(--brand-accent)",
              color: "var(--brand-accent-contrast)",
            }}
          >
            חפש
          </button>
        </div>
      </label>
    </form>
  );

  return (
    <>
    {searchBar}
    <div className="md:hidden mb-6">
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="w-full min-h-12 rounded-xl border inline-flex items-center justify-center gap-2 text-base font-bold hover-nudge"
        style={{
          background: "var(--brand-surface)",
          borderColor: "var(--brand-border)",
          color: "var(--brand-text)",
          boxShadow: "var(--brand-shadow)",
        }}
      >
        <span className="material-symbols-outlined" aria-hidden>
          tune
        </span>
        סינון
        {hasActiveFilters && (
          <span
            className="min-w-6 min-h-6 px-1.5 rounded-full text-sm font-bold inline-flex items-center justify-center"
            style={{
              background: "var(--brand-accent)",
              color: "var(--brand-accent-contrast)",
            }}
          >
            !
          </span>
        )}
      </button>
    </div>

    <div
      className="public-card border p-5 sm:p-6 mb-8 hidden md:block"
      style={{
        background: "var(--brand-surface)",
        borderColor: "var(--brand-border)",
        boxShadow: "var(--brand-shadow)",
      }}
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2
            className="text-lg font-bold"
          style={{ color: "var(--brand-text)" }}
        >
          סינון ומיון
        </h2>
        <div className="flex items-center gap-3">
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="min-h-12 px-2 text-sm font-medium underline-offset-4 hover:underline cursor-pointer hover-wiggle"
              style={{ color: "var(--brand-text-muted)" }}
            >
              נקה פילטרים
            </button>
          )}
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            aria-expanded={expanded}
            className="inline-flex min-h-12 items-center gap-1.5 px-2 text-sm font-semibold cursor-pointer hover-nudge"
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

      {filterFields}
      {expanded && secondaryFields}
    </div>

    {sheetOpen && (
      <div className="md:hidden fixed inset-0 z-50">
        <button
          type="button"
          className="absolute inset-0 bg-black/40"
          aria-label="סגור סינון"
          onClick={() => setSheetOpen(false)}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="סינון ומיון"
          className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t p-5"
          style={{
            background: "var(--brand-surface)",
            borderColor: "var(--brand-border)",
            paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))",
          }}
        >
          <div className="flex items-center justify-between gap-3 mb-5">
            <h2 className="text-lg font-bold" style={{ color: "var(--brand-text)" }}>
              סינון ומיון
            </h2>
            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="min-h-12 px-2 text-sm font-medium"
                  style={{ color: "var(--brand-text-muted)" }}
                >
                  נקה
                </button>
              )}
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="min-h-12 px-3 text-sm font-semibold"
                style={{ color: "var(--brand-accent)" }}
              >
                סגור
              </button>
            </div>
          </div>
          {filterFields}
          {secondaryFields}
        </div>
      </div>
    )}
    </>
  );
}
