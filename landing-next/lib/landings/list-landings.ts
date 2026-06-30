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

interface SupabaseLandingRow {
  id: string;
  course: { title?: string; description?: string };
  assets: { bannerThumbUrl?: string; bannerFullUrl?: string };
  start_date: string | null;
  price: number | null;
  sector: Sector | null;
  target_audience_tags: TargetAudienceTag[];
  created_at: string;
  likes_count?: number;
}

interface LocalLandingFile {
  id: string;
  course: { title?: string; description?: string };
  assets: {
    bannerUrl?: string;
    bannerThumbUrl?: string;
    backgroundUrl?: string;
  };
  metadata?: {
    start_date?: string | null;
    price?: number | null;
    sector?: Sector | null;
    target_audience_tags?: TargetAudienceTag[];
  };
  createdAt?: string;
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

export interface ListLandingsParams {
  audience?: string;
  sector?: string;
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
    from,
    to,
    maxPrice,
    sort = "recent",
    limit = 50,
    offset = 0,
  } = params;
  const cappedLimit = Math.min(limit, 200);

  if (isSupabaseDbEnabled()) {
    const admin = getSupabaseAdmin();
    let query = admin
      .from("landings_with_like_count")
      .select(
        "id, course, assets, start_date, price, sector, target_audience_tags, created_at, likes_count"
      )
      .eq("is_public", true);

    if (audience) query = query.contains("target_audience_tags", [audience]);
    if (sector) query = query.eq("sector", sector);
    if (from) query = query.gte("start_date", from);
    if (to) query = query.lte("start_date", to);
    if (maxPrice) query = query.lte("price", Number(maxPrice));

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
  const all: LandingsSummary[] = [];
  for (const file of files) {
    try {
      const content = await readFile(join(dir, file), "utf-8");
      const landing = JSON.parse(content) as LocalLandingFile;
      all.push(localToSummary(landing));
    } catch (e) {
      console.warn("Skipping bad landing file:", file, e);
    }
  }

  let items = all.filter((item) => {
    if (audience && !item.targetAudienceTags.includes(audience as TargetAudienceTag))
      return false;
    if (sector && item.sector !== sector) return false;
    if (from && (!item.startDate || item.startDate < from)) return false;
    if (to && (!item.startDate || item.startDate > to)) return false;
    if (maxPrice && (item.price ?? Infinity) > Number(maxPrice)) return false;
    return true;
  });

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
