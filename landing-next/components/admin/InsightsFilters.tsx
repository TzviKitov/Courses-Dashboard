"use client";

import { useState } from "react";
import { usePreserveViewNavigation } from "@/lib/navigation/preserve-view";
import {
  SECTOR_OPTIONS,
  TARGET_AUDIENCE_OPTIONS,
} from "@/types/course";

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "views", label: "הנצפים ביותר" },
  { value: "registrants", label: "הכי הרבה נרשמים" },
  { value: "completion", label: "אחוזי סיום הגבוהים" },
  { value: "placement", label: "אחוזי השמה הגבוהים" },
  { value: "instructor", label: "לפי מדריך/ה" },
];

type InsightsQuery = {
  year: string;
  sector: string;
  audience: string;
  sort: string;
  instructor: string;
};

function insightsHref(values: InsightsQuery) {
  const params = new URLSearchParams();
  if (values.year) params.set("year", values.year);
  if (values.sector) params.set("sector", values.sector);
  if (values.audience) params.set("audience", values.audience);
  if (values.sort && values.sort !== "views") params.set("sort", values.sort);
  if (values.instructor) params.set("instructor", values.instructor);
  const qs = params.toString();
  return qs ? `/dashboard/admin/insights?${qs}` : "/dashboard/admin/insights";
}

const fieldClass = "border rounded-md px-2 py-1.5 text-sm";
const fieldStyle = { borderColor: "var(--brand-border)" };

export function InsightsSummaryFilters({
  year,
  years,
  sector,
  audience,
  sort,
  instructor,
}: {
  year: number;
  years: number[];
  sector: string;
  audience: string;
  sort: string;
  instructor: string;
}) {
  const replace = usePreserveViewNavigation();
  const [yearValue, setYearValue] = useState(String(year));
  const [sectorValue, setSectorValue] = useState(sector);
  const [audienceValue, setAudienceValue] = useState(audience);
  // These values start from the URL. The page gives this component a `key` built from them,
  // so it starts again with fresh values whenever the URL changes (no effect needed).

  const apply = (patch: Partial<InsightsQuery>) => {
    replace(insightsHref({
      year: yearValue,
      sector: sectorValue,
      audience: audienceValue,
      sort,
      instructor,
      ...patch,
    }));
  };

  return (
    <form
      className="flex flex-wrap gap-3 mb-8 items-end"
      onSubmit={(event) => {
        event.preventDefault();
        apply({});
      }}
    >
      <label className="text-xs">
        <span className="block mb-1" style={{ color: "var(--brand-text-muted)" }}>
          שנה
        </span>
        <select
          name="year"
          data-preserve-focus="insights-year"
          value={yearValue}
          className={fieldClass}
          style={fieldStyle}
          onChange={(event) => {
            const next = event.target.value;
            setYearValue(next);
            apply({ year: next });
          }}
        >
          {years.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs">
        <span className="block mb-1" style={{ color: "var(--brand-text-muted)" }}>
          מגזר
        </span>
        <select
          name="sector"
          data-preserve-focus="insights-sector"
          value={sectorValue}
          className={fieldClass}
          style={fieldStyle}
          onChange={(event) => {
            const next = event.target.value;
            setSectorValue(next);
            apply({ sector: next });
          }}
        >
          <option value="">הכל</option>
          {SECTOR_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs">
        <span className="block mb-1" style={{ color: "var(--brand-text-muted)" }}>
          קהל יעד
        </span>
        <select
          name="audience"
          data-preserve-focus="insights-audience"
          value={audienceValue}
          className={fieldClass}
          style={fieldStyle}
          onChange={(event) => {
            const next = event.target.value;
            setAudienceValue(next);
            apply({ audience: next });
          }}
        >
          <option value="">הכל</option>
          {TARGET_AUDIENCE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        data-preserve-focus="insights-summary-submit"
        className="px-3 py-1.5 text-sm font-bold rounded-md text-white hover-nudge"
        style={{ background: "var(--brand-accent)" }}
      >
        סנן
      </button>
    </form>
  );
}

export function InsightsCourseFilters({
  year,
  sector,
  audience,
  sort,
  instructor,
  instructorOptions,
}: {
  year: number;
  sector: string;
  audience: string;
  sort: string;
  instructor: string;
  instructorOptions: { key: string; name: string }[];
}) {
  const replace = usePreserveViewNavigation();
  const [sortValue, setSortValue] = useState(sort);
  const [instructorValue, setInstructorValue] = useState(instructor);
  // Same as above: the page keys this component on `sort|instructor`.

  const apply = (patch: Partial<InsightsQuery>) => {
    replace(insightsHref({
      year: String(year),
      sector,
      audience,
      sort: sortValue,
      instructor: instructorValue,
      ...patch,
    }));
  };

  return (
    <form
      className="flex flex-wrap gap-3 items-end"
      onSubmit={(event) => {
        event.preventDefault();
        apply({});
      }}
    >
      <label className="text-xs">
        <span className="block mb-1" style={{ color: "var(--brand-text-muted)" }}>
          מיון
        </span>
        <select
          name="sort"
          data-preserve-focus="insights-sort"
          value={sortValue}
          className={`${fieldClass} bg-white`}
          style={{ borderColor: "var(--brand-border)", color: "var(--brand-text)" }}
          onChange={(event) => {
            const next = event.target.value;
            setSortValue(next);
            apply({ sort: next });
          }}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs">
        <span className="block mb-1" style={{ color: "var(--brand-text-muted)" }}>
          מדריך/ה
        </span>
        <select
          name="instructor"
          data-preserve-focus="insights-instructor"
          value={instructorValue}
          className={`${fieldClass} bg-white max-w-[16rem]`}
          style={{ borderColor: "var(--brand-border)", color: "var(--brand-text)" }}
          onChange={(event) => {
            const next = event.target.value;
            setInstructorValue(next);
            apply({ instructor: next });
          }}
        >
          <option value="">הכל</option>
          {instructorOptions.map((option) => (
            <option key={option.key} value={option.key}>
              {option.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        data-preserve-focus="insights-course-submit"
        className="px-3 py-1.5 text-sm font-bold rounded-md text-white hover-nudge"
        style={{ background: "var(--brand-accent)" }}
      >
        הצג
      </button>
    </form>
  );
}
