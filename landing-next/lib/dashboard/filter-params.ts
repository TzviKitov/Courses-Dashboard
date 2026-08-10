import {
  AUDIENCE_CATEGORY_OPTIONS,
  AVAILABILITY_FILTER_OPTIONS,
  COURSE_TYPE_OPTIONS,
  GENDER_SEPARATION_OPTIONS,
  SECTOR_OPTIONS,
  type AvailabilityFilter,
  type CourseType,
  type GenderSeparation,
  type Sector,
  type TargetAudienceTag,
} from "@/types/course";

export type DashboardSort = "recent" | "popular" | "starting_soon";

export interface DashboardFiltersState {
  audience?: TargetAudienceTag;
  sector?: Sector;
  gender?: GenderSeparation;
  courseType?: CourseType;
  availability?: AvailabilityFilter;
  /** Used when availability === "open_from". */
  from?: string;
  to?: string;
  maxPrice?: string;
  sort: DashboardSort;
}

const VALID_AUDIENCE = new Set<string>(
  AUDIENCE_CATEGORY_OPTIONS.map((o) => o.tag)
);
const VALID_SECTOR = new Set<string>(SECTOR_OPTIONS.map((o) => o.value));
const VALID_GENDER = new Set<string>(GENDER_SEPARATION_OPTIONS.map((o) => o.value));
const VALID_COURSE_TYPE = new Set<string>(COURSE_TYPE_OPTIONS.map((o) => o.value));
const VALID_AVAILABILITY = new Set<string>(
  AVAILABILITY_FILTER_OPTIONS.map((o) => o.value)
);
const VALID_SORT = new Set<string>(["recent", "popular", "starting_soon"]);

function sanitizeAudience(value: string | null): TargetAudienceTag | undefined {
  if (!value || !VALID_AUDIENCE.has(value)) return undefined;
  return value as TargetAudienceTag;
}

function sanitizeSector(value: string | null): Sector | undefined {
  if (!value || !VALID_SECTOR.has(value)) return undefined;
  return value as Sector;
}

function sanitizeGender(value: string | null): GenderSeparation | undefined {
  if (!value || !VALID_GENDER.has(value)) return undefined;
  return value as GenderSeparation;
}

function sanitizeCourseType(value: string | null): CourseType | undefined {
  if (!value || !VALID_COURSE_TYPE.has(value)) return undefined;
  return value as CourseType;
}

function sanitizeAvailability(value: string | null): AvailabilityFilter | undefined {
  if (!value || !VALID_AVAILABILITY.has(value)) return undefined;
  return value as AvailabilityFilter;
}

function sanitizeSort(value: string | null): DashboardSort {
  if (value && VALID_SORT.has(value)) return value as DashboardSort;
  return "recent";
}

/** Parse and sanitize gallery filter params from URL search params. */
export function parseDashboardFilters(
  params: URLSearchParams | Record<string, string | string[] | undefined>
): DashboardFiltersState {
  const get = (key: string): string | null => {
    if (params instanceof URLSearchParams) {
      return params.get(key);
    }
    const v = params[key];
    if (typeof v === "string" && v) return v;
    return null;
  };

  const maxPrice = get("maxPrice");
  const availability = sanitizeAvailability(get("availability"));
  const from = get("from");
  const to = get("to");

  return {
    audience: sanitizeAudience(get("audience")),
    sector: sanitizeSector(get("sector")),
    gender: sanitizeGender(get("gender")),
    courseType: sanitizeCourseType(get("courseType")),
    availability,
    // Date "from" only applies with open_from; ignore stray legacy ?from= alone.
    from: availability === "open_from" && from ? from : undefined,
    to: to || undefined,
    maxPrice: maxPrice || undefined,
    sort: sanitizeSort(get("sort")),
  };
}

/** True when any filter (not default sort) is active in the URL. */
export function hasActiveFilters(filters: DashboardFiltersState): boolean {
  return Boolean(
    filters.audience ||
      filters.sector ||
      filters.gender ||
      filters.courseType ||
      filters.availability ||
      filters.from ||
      filters.to ||
      filters.maxPrice ||
      filters.sort !== "recent"
  );
}

/** True when content filters (excluding sort) are active. */
export function hasContentFilters(filters: DashboardFiltersState): boolean {
  return Boolean(
    filters.audience ||
      filters.sector ||
      filters.gender ||
      filters.courseType ||
      filters.availability ||
      filters.from ||
      filters.to ||
      filters.maxPrice
  );
}

/** Params for listLandings(). */
export function filtersToListParams(filters: DashboardFiltersState) {
  return {
    audience: filters.audience,
    sector: filters.sector,
    gender: filters.gender,
    courseType: filters.courseType,
    availability: filters.availability,
    from: filters.from,
    to: filters.to,
    maxPrice: filters.maxPrice,
    sort: filters.sort,
  };
}

/** Client-side shape matching DashboardFilters form fields. */
export function filtersToFormState(filters: DashboardFiltersState) {
  return {
    audience: filters.audience || "",
    sector: filters.sector || "",
    gender: filters.gender || "",
    courseType: filters.courseType || "",
    availability: filters.availability || "",
    maxPrice: filters.maxPrice || "",
    from: filters.from || "",
    to: filters.to || "",
    sort: filters.sort,
  };
}

export function hasActiveFiltersFromSearchParams(searchParams: URLSearchParams): boolean {
  return hasActiveFilters(parseDashboardFilters(searchParams));
}

export function hasContentFiltersFromSearchParams(searchParams: URLSearchParams): boolean {
  return hasContentFilters(parseDashboardFilters(searchParams));
}
