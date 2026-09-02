import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import {
  getSupabaseAdmin,
  isSupabaseDbEnabled,
} from "@/lib/supabase/server";
import type {
  LandingsSummary,
  Sector,
  TargetAudienceTag,
} from "@/lib/supabase/types";
import type { AvailabilityFilter } from "@/types/course";

interface SupabaseLandingRow {
  id: string;
  course: {
    title?: string;
    description?: string;
    courseType?: string;
    genderSeparation?: string;
    schedule?: { endDate?: string };
  };
  assets: { bannerThumbUrl?: string; bannerFullUrl?: string };
  start_date: string | null;
  end_date: string | null;
  price: number | null;
  sector: Sector | null;
  target_audience_tags: TargetAudienceTag[];
  created_at: string;
  likes_count?: number;
}

interface LocalLandingFile {
  id: string;
  course: {
    title?: string;
    description?: string;
    courseType?: string;
    genderSeparation?: string;
    schedule?: { endDate?: string; startDate?: string };
  };
  assets: {
    bannerUrl?: string;
    bannerThumbUrl?: string;
    backgroundUrl?: string;
  };
  metadata?: {
    start_date?: string | null;
    end_date?: string | null;
    price?: number | null;
    sector?: Sector | null;
    target_audience_tags?: TargetAudienceTag[];
    course_type?: string | null;
    gender_separation?: string | null;
  };
  createdAt?: string;
}

function todayInIsrael(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
}

function rowToSummary(row: SupabaseLandingRow): LandingsSummary {
  return {
    id: row.id,
    title: row.course?.title || "",
    description: row.course?.description || "",
    bannerThumbUrl: row.assets?.bannerThumbUrl || row.assets?.bannerFullUrl,
    startDate: row.start_date,
    price: row.price,
    sector: row.sector,
    targetAudienceTags: row.target_audience_tags || [],
    likesCount: row.likes_count ?? 0,
    createdAt: row.created_at,
  };
}

function localToSummary(landing: LocalLandingFile): LandingsSummary {
  return {
    id: landing.id,
    title: landing.course?.title || "",
    description: landing.course?.description || "",
    bannerThumbUrl: landing.assets?.bannerThumbUrl || landing.assets?.bannerUrl,
    startDate: landing.metadata?.start_date ?? null,
    price: landing.metadata?.price ?? null,
    sector: landing.metadata?.sector ?? null,
    targetAudienceTags: landing.metadata?.target_audience_tags ?? [],
    likesCount: 0,
    createdAt: landing.createdAt || "",
  };
}

function localCourseType(landing: LocalLandingFile): string | null {
  return landing.metadata?.course_type || landing.course?.courseType || null;
}

function localGender(landing: LocalLandingFile): string | null {
  return (
    landing.metadata?.gender_separation ||
    landing.course?.genderSeparation ||
    null
  );
}

function localEndDate(landing: LocalLandingFile): string | null {
  return (
    landing.metadata?.end_date ||
    landing.course?.schedule?.endDate ||
    null
  );
}

function matchesAvailabilityLocal(
  startDate: string | null,
  endDate: string | null,
  courseType: string | null,
  availability: AvailabilityFilter,
  from?: string
): boolean {
  const today = todayInIsrael();
  switch (availability) {
    case "open":
      return !endDate || endDate >= today;
    case "year_round":
      return courseType === "year_round";
    case "ended":
      return Boolean(endDate && endDate < today);
    case "open_from":
      if (!from) return true;
      return Boolean(startDate && startDate >= from);
    default:
      return true;
  }
}

export interface ListLandingsParams {
  audience?: string;
  sector?: string;
  gender?: string;
  courseType?: string;
  availability?: string;
  from?: string;
  to?: string;
  maxPrice?: string;
  sort?: string;
  limit?: number;
  offset?: number;
}

export interface ListLandingsResult {
  items: LandingsSummary[];
  error: string | null;
}

/** Load public landings for gallery/dashboard (no HTTP roundtrip). */
export async function listLandings(
  params: ListLandingsParams = {}
): Promise<ListLandingsResult> {
  const {
    audience,
    sector,
    gender,
    courseType,
    availability,
    from,
    to,
    maxPrice,
    sort = "recent",
    limit = 50,
    offset = 0,
  } = params;
  const cappedLimit = Math.min(limit, 200);
  const today = todayInIsrael();

  if (isSupabaseDbEnabled()) {
    const admin = getSupabaseAdmin();
    let query = admin
      .from("landings_with_like_count")
      .select(
        "id, course, assets, start_date, end_date, price, sector, target_audience_tags, created_at, likes_count"
      )
      .eq("is_public", true);

    if (audience) query = query.contains("target_audience_tags", [audience]);
    if (sector) query = query.eq("sector", sector);
    if (gender) query = query.eq("course->>genderSeparation", gender);
    if (courseType) query = query.eq("course->>courseType", courseType);
    if (maxPrice) query = query.lte("price", Number(maxPrice));

    if (availability === "open") {
      query = query.or(`end_date.is.null,end_date.gte.${today}`);
    } else if (availability === "year_round") {
      query = query.eq("course->>courseType", "year_round");
    } else if (availability === "ended") {
      query = query.not("end_date", "is", null).lt("end_date", today);
    } else if (availability === "open_from" && from) {
      query = query.gte("start_date", from);
    } else {
      // Legacy / API: bare from/to still supported when no availability mode.
      if (!availability && from) query = query.gte("start_date", from);
      if (to) query = query.lte("start_date", to);
    }

    if (sort === "popular") query = query.order("likes_count", { ascending: false });
    else if (sort === "starting_soon")
      query = query.order("start_date", { ascending: true, nullsFirst: false });
    else query = query.order("created_at", { ascending: false });

    query = query.range(offset, offset + cappedLimit - 1);

    const { data, error } = await query;
    if (error) {
      console.error("listLandings supabase error:", error);
      return { items: [], error: error.message };
    }

    return {
      items: (data as SupabaseLandingRow[]).map(rowToSummary),
      error: null,
    };
  }

  const dir = join(process.cwd(), "data", "landings");
  if (!existsSync(dir)) return { items: [], error: null };

  const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  const all: { summary: LandingsSummary; raw: LocalLandingFile }[] = [];
  for (const file of files) {
    try {
      const content = await readFile(join(dir, file), "utf-8");
      const landing = JSON.parse(content) as LocalLandingFile;
      all.push({ summary: localToSummary(landing), raw: landing });
    } catch (e) {
      console.warn("Skipping bad landing file:", file, e);
    }
  }

  const filtered = all.filter(({ summary, raw }) => {
    if (audience && !summary.targetAudienceTags.includes(audience as TargetAudienceTag))
      return false;
    if (sector && summary.sector !== sector) return false;
    if (gender && localGender(raw) !== gender) return false;
    if (courseType && localCourseType(raw) !== courseType) return false;
    if (maxPrice && (summary.price ?? Infinity) > Number(maxPrice)) return false;

    if (availability) {
      return matchesAvailabilityLocal(
        summary.startDate,
        localEndDate(raw),
        localCourseType(raw),
        availability as AvailabilityFilter,
        from
      );
    }

    if (from && (!summary.startDate || summary.startDate < from)) return false;
    if (to && (!summary.startDate || summary.startDate > to)) return false;
    return true;
  });

  const items = filtered.map((x) => x.summary);

  if (sort === "starting_soon") {
    items.sort((a, b) =>
      (a.startDate || "9999").localeCompare(b.startDate || "9999")
    );
  } else if (sort === "popular") {
    items.sort((a, b) => b.likesCount - a.likesCount);
  } else {
    items.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  }

  return { items: items.slice(offset, offset + cappedLimit), error: null };
}
