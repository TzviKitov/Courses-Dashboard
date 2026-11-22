"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import {
  usePreserveViewNavigation,
  type PreserveViewOptions,
} from "@/lib/navigation/preserve-view";
import {
  DEFAULT_AVAILABILITY,
  type DashboardSort,
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

type FormState = ReturnType<typeof filtersToFormState>;

function ActivityPanel({
  title,
  hint,
  sheet = false,
  labelled = false,
  children,
}: {
  title: string;
  hint?: string;
  sheet?: boolean;
  labelled?: boolean;
  children: ReactNode;
}) {
  const Tag = labelled ? "label" : "div";
  return (
    <Tag className={sheet ? "mt-4 block" : "av-select"}>
      {sheet ? (
        <span className="mb-2 block text-[15px] font-bold">{title}</span>
      ) : (
        <span>{title}</span>
      )}
      <div className={sheet ? "av-filter-detail is-sheet" : "av-filter-detail"}>
        {hint ? <p className="av-filter-detail-hint">{hint}</p> : null}
        {children}
      </div>
    </Tag>
  );
}

function emptyFilters(q: string): FormState {
  return {
    audience: "",
    sector: "",
    gender: "",
    courseType: "",
    availability: DEFAULT_AVAILABILITY,
    maxPrice: "",
    from: "",
    dateFrom: "",
    dateTo: "",
    to: "",
    q,
    sort: "recent",
  };
}

function toParams(form: FormState): URLSearchParams {
  const next = new URLSearchParams();
  if (form.q) next.set("q", form.q);
  if (form.audience) next.set("audience", form.audience);
  if (form.sector) next.set("sector", form.sector);
  if (form.gender) next.set("gender", form.gender);
  if (form.courseType) next.set("courseType", form.courseType);
  // "" is the explicit "everything"; the default ("open") needs no param
  if (form.availability === "") next.set("availability", "all");
  else if (form.availability !== DEFAULT_AVAILABILITY) next.set("availability", form.availability);
  if (form.availability === "open_from" && form.from) next.set("from", form.from);
  if (form.availability === "active_range" && form.dateFrom) next.set("dateFrom", form.dateFrom);
  if (form.availability === "active_range" && form.dateTo) next.set("dateTo", form.dateTo);
  if (form.to) next.set("to", form.to);
  if (form.maxPrice) next.set("maxPrice", form.maxPrice);
  if (form.sort !== "recent") next.set("sort", form.sort);
  return next;
}

function activeCount(form: FormState): number {
  return [
    form.audience,
    form.sector,
    form.gender,
    form.courseType,
    form.availability !== DEFAULT_AVAILABILITY ? "x" : "",
    form.maxPrice,
    form.sort !== "recent" ? form.sort : "",
  ].filter(Boolean).length;
}

export function DashboardFilters() {
  const searchParams = useSearchParams();
  const replace = usePreserveViewNavigation();
  const paramsRef = useRef(new URLSearchParams(searchParams.toString()));
  const issuedRef = useRef(searchParams.toString());
  const inflightRef = useRef(false);
  const filterButtonRef = useRef<HTMLButtonElement>(null);

  const current = useMemo(
    () => filtersToFormState(parseDashboardFilters(searchParams)),
    [searchParams]
  );

  const hasSecondaryFilters =
    current.availability !== DEFAULT_AVAILABILITY ||
    Boolean(current.dateFrom) ||
    Boolean(current.dateTo) ||
    Boolean(current.maxPrice) ||
    current.sort !== "recent";

  const [expanded, setExpanded] = useState(hasSecondaryFilters);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [queryDraft, setQueryDraft] = useState(current.q);
  const [priceDraft, setPriceDraft] = useState(current.maxPrice);
  const [draft, setDraft] = useState<FormState>(current);
  const [resultCount, setResultCount] = useState<number | null>(null);

  const navigate = useCallback((next: URLSearchParams, options?: PreserveViewOptions) => {
    const qs = next.toString();
    const href = qs ? `/dashboard?${qs}` : "/dashboard";
    if (!replace(href, options)) return;
    paramsRef.current = new URLSearchParams(qs);
    issuedRef.current = qs;
    inflightRef.current = true;
  }, [replace]);

  useEffect(() => {
    const committed = searchParams.toString();
    if (committed === issuedRef.current) {
      inflightRef.current = false;
      paramsRef.current = new URLSearchParams(committed);
      return;
    }
    if (!inflightRef.current) {
      paramsRef.current = new URLSearchParams(committed);
      issuedRef.current = committed;
    }
  }, [searchParams]);

  const updateParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(paramsRef.current.toString());
      if (value === "") next.delete(key);
      else next.set(key, value);
      navigate(next);
    },
    [navigate]
  );

  const updateAvailability = useCallback(
    (value: string) => {
      const next = new URLSearchParams(paramsRef.current.toString());
      if (value === "" || value === DEFAULT_AVAILABILITY) {
        // "" = everything (explicit param); "open" = the default (no param)
        if (value === "") next.set("availability", "all");
        else next.delete("availability");
        next.delete("from");
        next.delete("dateFrom");
        next.delete("dateTo");
      } else {
        next.set("availability", value);
        if (value !== "open_from") next.delete("from");
        if (value !== "active_range") {
          next.delete("dateFrom");
          next.delete("dateTo");
        }
      }
      navigate(next);
    },
    [navigate]
  );

  const updateDateRange = useCallback(
    (key: "dateFrom" | "dateTo", value: string) => {
      const next = new URLSearchParams(paramsRef.current.toString());
      if (value) next.set(key, value);
      else next.delete(key);

      if (
        key === "dateFrom" &&
        value &&
        next.get("dateTo") &&
        value > next.get("dateTo")!
      ) {
        next.delete("dateTo");
      }
      if (
        key === "dateTo" &&
        value &&
        next.get("dateFrom") &&
        value < next.get("dateFrom")!
      ) {
        next.delete("dateFrom");
      }
      navigate(next);
    },
    [navigate]
  );

  const resetFilters = useCallback(() => {
    const next = new URLSearchParams();
    const q = paramsRef.current.get("q");
    if (q) next.set("q", q);
    setPriceDraft("");
    navigate(next, { fallbackFocus: "gallery-search" });
  }, [navigate]);

  const applySearch = useCallback(
    (value: string, options?: PreserveViewOptions) => {
      const next = new URLSearchParams(paramsRef.current.toString());
      const cleaned = sanitizeSearchQuery(value);
      if (!cleaned) next.delete("q");
      else next.set("q", cleaned);
      navigate(next, options);
    },
    [navigate]
  );

  useEffect(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.dataset.preserveFocus === "gallery-search") return;
    setQueryDraft(current.q);
  }, [current.q]);

  useEffect(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.dataset.preserveFocus === "filter-max-price") return;
    setPriceDraft(current.maxPrice);
  }, [current.maxPrice]);

  useEffect(() => {
    const urlPrice = paramsRef.current.get("maxPrice") ?? "";
    if (priceDraft === urlPrice) return;
    const timer = window.setTimeout(() => {
      if ((paramsRef.current.get("maxPrice") ?? "") === priceDraft) return;
      const next = new URLSearchParams(paramsRef.current.toString());
      if (priceDraft) next.set("maxPrice", priceDraft);
      else next.delete("maxPrice");
      const active = document.activeElement;
      const stillEditing =
        active instanceof HTMLElement && active.dataset.preserveFocus === "filter-max-price";
      navigate(next, stillEditing ? undefined : { preserveFocus: false });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [navigate, priceDraft]);

  const openSheet = () => {
    setDraft({ ...current, q: current.q });
    setResultCount(null);
    setSheetOpen(true);
  };

  const closeSheet = () => {
    setSheetOpen(false);
    filterButtonRef.current?.focus();
  };

  useEffect(() => {
    if (!sheetOpen) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const params = toParams(draft);
        // the API has no default; send what the gallery will actually query with
        if (params.get("availability") === "all") params.delete("availability");
        else if (!params.has("availability")) params.set("availability", DEFAULT_AVAILABILITY);
        params.set("limit", "200");
        const response = await fetch(`/api/landings?${params.toString()}`, { signal: controller.signal });
        const data = await response.json();
        if (data?.success && typeof data.count === "number") setResultCount(data.count);
        else setResultCount(null);
      } catch {
        if (!controller.signal.aborted) setResultCount(null);
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [draft, sheetOpen]);

  const hasActiveFilters = hasActiveFiltersFromSearchParams(searchParams);
  const count = activeCount(current);

  const select = (
    focusKey: string,
    label: string,
    value: string,
    onChange: (value: string) => void,
    options: { value: string; label: string }[],
    emptyLabel: string
  ) => (
    <label className="av-select">
      <span>{label}</span>
      <select
        data-preserve-focus={focusKey}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{emptyLabel}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </label>
  );

  const shortcutChips = (scope: "mobile" | "desktop") => (
    <div
      className={scope === "mobile" ? "flex gap-2 overflow-x-auto pb-1" : "flex gap-2 flex-wrap"}
      style={scope === "mobile" ? undefined : { marginInlineStart: "auto" }}
    >
      <button
        type="button"
        className="av-chip"
        data-preserve-focus={`${scope}-chip-all`}
        aria-pressed={!current.audience && current.availability === ""}
        onClick={() => {
          const next = new URLSearchParams(paramsRef.current.toString());
          next.delete("audience");
          next.set("availability", "all");
          next.delete("from");
          next.delete("dateFrom");
          next.delete("dateTo");
          navigate(next);
        }}
      >
        הכל
      </button>
      <button
        type="button"
        className="av-chip av-chip-youth"
        data-preserve-focus={`${scope}-chip-youth`}
        aria-pressed={current.audience === "youth"}
        onClick={() => updateParam("audience", current.audience === "youth" ? "" : "youth")}
      >
        נוער
      </button>
      <button
        type="button"
        className="av-chip av-chip-young"
        data-preserve-focus={`${scope}-chip-young`}
        aria-pressed={current.audience === "young_adults"}
        onClick={() => updateParam("audience", current.audience === "young_adults" ? "" : "young_adults")}
      >
        צעירים
      </button>
      <button
        type="button"
        className="av-chip"
        data-preserve-focus={`${scope}-chip-open`}
        aria-pressed={current.availability === "open"}
        onClick={() => updateAvailability(current.availability === "open" ? "" : "open")}
      >
        פתוח להרשמה
      </button>
    </div>
  );

  const sheetGroup = (
    legend: string,
    value: string,
    options: { value: string; label: string }[],
    onPick: (value: string) => void
  ) => (
    <fieldset className="border-0 mt-4">
      <legend className="font-bold text-[15px] mb-2">{legend}</legend>
      <div className="flex gap-2 flex-wrap">
        {options.map((opt) => {
          const pressed = value === opt.value;
          return (
            <button
              key={opt.value || "all"}
              type="button"
              className="av-chip"
              style={{ minHeight: 44 }}
              aria-pressed={pressed}
              onClick={() => onPick(opt.value)}
            >
              {pressed ? (
                <span className="material-symbols-rounded" aria-hidden style={{ fontSize: 16 }}>check</span>
              ) : null}
              {opt.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );

  const resultLabel =
    resultCount === null
      ? "הצגת תוצאות"
      : `הצגת ${resultCount >= 200 ? "200+" : resultCount} קורסים`;

  const activityPanel = (
    sheet: boolean,
    availability: string,
    from: string,
    dateFrom: string,
    dateTo: string,
    onFrom: (value: string) => void,
    onDate: (key: "dateFrom" | "dateTo", value: string) => void
  ) => (
    <>
      {availability === "open_from" ? (
        <ActivityPanel title="פתוחים מ-" sheet={sheet} labelled>
          <input
            className="av-input"
            type="date"
            value={from}
            {...(sheet ? {} : { "data-preserve-focus": "filter-from" })}
            onChange={(event) => onFrom(event.target.value)}
          />
        </ActivityPanel>
      ) : null}
      {availability === "active_range" ? (
        <ActivityPanel
          title="טווח פעילות הקורס"
          hint="יוצגו קורסים שהיו פעילים גם בחלק מהטווח"
          sheet={sheet}
        >
          <div className={sheet ? "grid grid-cols-2 gap-3" : "flex items-end gap-2"}>
            <label className="av-select">
              <span>מתאריך</span>
              <input
                className="av-input"
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                {...(sheet ? {} : { "data-preserve-focus": "filter-date-from" })}
                onChange={(event) => onDate("dateFrom", event.target.value)}
              />
            </label>
            <label className="av-select">
              <span>עד תאריך</span>
              <input
                className="av-input"
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                {...(sheet ? {} : { "data-preserve-focus": "filter-date-to" })}
                onChange={(event) => onDate("dateTo", event.target.value)}
              />
            </label>
          </div>
        </ActivityPanel>
      ) : null}
    </>
  );

  return (
    <>
      <form
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
        <label className="sr-only" htmlFor="gallery-search">חיפוש קורס</label>
        <div className="flex gap-2">
          <div className="av-field">
            <span className="material-symbols-rounded" aria-hidden style={{ fontSize: 20, color: "var(--color-text-muted)" }}>
              search
            </span>
            <input
              id="gallery-search"
              data-preserve-focus="gallery-search"
              type="text"
              name="q"
              value={queryDraft}
              onChange={(event) => setQueryDraft(event.target.value)}
              placeholder="חיפוש לפי שם, תיאור או מיקום"
              maxLength={80}
              enterKeyHint="search"
            />
            {queryDraft ? (
              <button
                type="button"
                data-preserve-focus="gallery-search-clear"
                aria-label="נקה חיפוש"
                onClick={() => {
                  setQueryDraft("");
                  if (current.q) applySearch("", { fallbackFocus: "gallery-search" });
                }}
                className="shrink-0 min-h-11 min-w-11 inline-flex items-center justify-center"
              >
                <span className="material-symbols-rounded" aria-hidden style={{ fontSize: 20 }}>close</span>
              </button>
            ) : null}
          </div>
          <button type="submit" data-preserve-focus="gallery-search-submit" className="av-btn av-btn-primary hidden md:inline-flex" style={{ minHeight: 52, paddingInline: 28 }}>
            חיפוש
          </button>
          <button
            ref={filterButtonRef}
            type="button"
            data-preserve-focus="gallery-filter-button"
            className="av-btn av-btn-ghost md:hidden"
            aria-label="סינון"
            style={{ minHeight: 48, paddingInline: 14 }}
            onClick={openSheet}
          >
            <span className="material-symbols-rounded" aria-hidden style={{ fontSize: 20 }}>tune</span>
            סינון
            {count > 0 ? <span className="tabular-nums">{count}</span> : null}
          </button>
        </div>
      </form>

      <div className="mt-3 md:hidden">{shortcutChips("mobile")}</div>

      <div className="hidden md:block mt-3">
        <div className="flex items-end justify-between gap-3 mb-3">
          <span className="text-sm font-semibold" style={{ color: "var(--color-text-muted)" }}>סינון ומיון</span>
          <div className="flex items-center gap-2">
            {hasActiveFilters ? (
              <button
                type="button"
                data-preserve-focus="gallery-reset"
                onClick={resetFilters}
                className="av-btn av-btn-ghost"
              >
                נקה פילטרים
              </button>
            ) : null}
            <button type="button" data-preserve-focus="gallery-more-options" aria-expanded={expanded} className="av-btn av-btn-ghost" onClick={() => setExpanded((prev) => !prev)}>
              {expanded ? "פחות אפשרויות" : "עוד אפשרויות"}
            </button>
          </div>
        </div>
        <div className="flex gap-2.5 flex-wrap items-end">
          {select("filter-audience", "קהל יעד", current.audience, (value) => updateParam("audience", value), AUDIENCE_CATEGORY_OPTIONS.map((opt) => ({ value: opt.tag, label: opt.label })), "כולם")}
          {select("filter-gender", "מגדר", current.gender, (value) => updateParam("gender", value), GENDER_SEPARATION_OPTIONS, "הכל")}
          {select("filter-course-type", "סוג קורס", current.courseType, (value) => updateParam("courseType", value), COURSE_TYPE_OPTIONS, "הכל")}
          {select("filter-sector", "מגזר", current.sector, (value) => updateParam("sector", value), SECTOR_OPTIONS, "הכל")}
          {shortcutChips("desktop")}
        </div>
        {expanded ? (
          <div className="mt-4 flex gap-2.5 flex-wrap items-start">
            {select("filter-availability", "סטטוס פעילות", current.availability, updateAvailability, AVAILABILITY_FILTER_OPTIONS, "הכל")}
            {activityPanel(
              false,
              current.availability,
              current.from,
              current.dateFrom,
              current.dateTo,
              (value) => updateParam("from", value),
              updateDateRange
            )}
            <label className="av-select">
              <span>מחיר מקסימלי (ש&quot;ח)</span>
              <input
                className="av-input"
                type="number"
                min={0}
                step={50}
                data-preserve-focus="filter-max-price"
                value={priceDraft}
                placeholder="ללא תקרה"
                onChange={(event) => setPriceDraft(event.target.value)}
              />
            </label>
            <div className="av-select">
              <span>מיון</span>
              <div className="flex min-h-11 items-center gap-2 flex-wrap">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className="av-chip"
                    data-preserve-focus={`filter-sort-${opt.value}`}
                    aria-pressed={current.sort === opt.value}
                    onClick={() => updateParam("sort", opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <BottomSheet open={sheetOpen} onClose={closeSheet} title="סינון">
        {sheetGroup("קהל יעד", draft.audience, [{ value: "", label: "כולם" }, ...AUDIENCE_CATEGORY_OPTIONS.map((opt) => ({ value: opt.tag, label: opt.label }))], (value) => setDraft((prev) => ({ ...prev, audience: value })))}
        {sheetGroup("מגדר", draft.gender, [{ value: "", label: "הכל" }, ...GENDER_SEPARATION_OPTIONS], (value) => setDraft((prev) => ({ ...prev, gender: value })))}
        {sheetGroup("סוג קורס", draft.courseType, [{ value: "", label: "הכל" }, ...COURSE_TYPE_OPTIONS], (value) => setDraft((prev) => ({ ...prev, courseType: value })))}
        {sheetGroup("מגזר", draft.sector, [{ value: "", label: "הכל" }, ...SECTOR_OPTIONS], (value) => setDraft((prev) => ({ ...prev, sector: value })))}
        {sheetGroup("סטטוס פעילות", draft.availability, [{ value: "", label: "הכל" }, ...AVAILABILITY_FILTER_OPTIONS], (value) => setDraft((prev) => ({
          ...prev,
          availability: value,
          from: value === "open_from" ? prev.from : "",
          dateFrom: value === "active_range" ? prev.dateFrom : "",
          dateTo: value === "active_range" ? prev.dateTo : "",
        })))}
        {activityPanel(
          true,
          draft.availability,
          draft.from,
          draft.dateFrom,
          draft.dateTo,
          (value) => setDraft((prev) => ({ ...prev, from: value })),
          (key, value) => setDraft((prev) => {
            if (key === "dateFrom") {
              return {
                ...prev,
                dateFrom: value,
                dateTo: prev.dateTo && value > prev.dateTo ? "" : prev.dateTo,
              };
            }
            return {
              ...prev,
              dateTo: value,
              dateFrom: prev.dateFrom && value && value < prev.dateFrom ? "" : prev.dateFrom,
            };
          })
        )}
        <label className="av-select mt-4">
          <span>מחיר מקסימלי (ש&quot;ח)</span>
          <input className="av-input" type="number" min={0} step={50} value={draft.maxPrice} placeholder="ללא תקרה" onChange={(event) => setDraft((prev) => ({ ...prev, maxPrice: event.target.value }))} />
        </label>
        {sheetGroup("מיון", draft.sort, SORT_OPTIONS, (value) => setDraft((prev) => ({ ...prev, sort: (value || "recent") as DashboardSort })))}
        <div className="flex gap-2.5 mt-6">
          <button
            type="button"
            className="av-btn av-btn-ghost"
            style={{ flex: 1 }}
            onClick={() => setDraft(emptyFilters(current.q))}
          >
            ניקוי
          </button>
          <button
            type="button"
            className="av-btn av-btn-primary"
            style={{ flex: 2 }}
            onClick={() => {
              setSheetOpen(false);
              navigate(toParams({ ...draft, q: current.q }), { focus: "gallery-filter-button" });
            }}
          >
            {resultLabel}
          </button>
        </div>
      </BottomSheet>
    </>
  );
}
