import type { LandingPageData } from "@/types/landing";

export type TargetAudienceTag =
  | "youth"
  | "young_adults"
  | "adults"
  | "seniors"
  | "parents"
  | "professionals"
  | "students"
  | "general";

export type Sector = "haredi" | "east_jerusalem" | "general";

/** Row stored in the `landings` table. */
export interface LandingRow {
  id: string;
  course: LandingPageData["course"];
  assets: LandingAssets;
  theme: LandingPageData["theme"];
  form: LandingPageData["form"];
  owner_id: string | null;
  is_public: boolean;
  /** ISO date string for filtering by start. */
  start_date: string | null;
  /** Numeric price (NIS). null = unknown/free. */
  price: number | null;
  sector: Sector | null;
  target_audience_tags: TargetAudienceTag[];
  created_at: string;
  updated_at: string;
}

/**
 * Asset URLs stored alongside a landing.
 * Full variant for landing/hero, thumb for dashboard tiles.
 */
export interface LandingAssets {
  bannerFullUrl?: string;
  bannerThumbUrl?: string;
  backgroundFullUrl?: string;
  backgroundThumbUrl?: string;
}

/** Row stored in the `likes` table. */
export interface LikeRow {
  landing_id: string;
  /** Anonymous cookie ID OR authenticated user_id. */
  identity: string;
  user_id: string | null;
  created_at: string;
}

/** Row stored in the `registrations` table (Wave 3). */
export interface RegistrationRow {
  id: string;
  landing_id: string;
  full_name: string;
  phone: string;
  email: string;
  referral: string | null;
  notes: string | null;
  created_at: string;
}

/**
 * Filters accepted by GET /api/landings.
 */
export interface LandingsListFilters {
  audience?: TargetAudienceTag;
  sector?: Sector;
  /** ISO date - only landings starting on or after this date. */
  from?: string;
  /** ISO date - only landings starting on or before this date. */
  to?: string;
  /** Max price (NIS). */
  maxPrice?: number;
  sort?: "popular" | "recent" | "starting_soon";
  limit?: number;
  offset?: number;
}

/** Public summary returned by GET /api/landings - smaller than full row. */
export interface LandingsSummary {
  id: string;
  title: string;
  description: string;
  bannerThumbUrl?: string;
  startDate: string | null;
  price: number | null;
  sector: Sector | null;
  targetAudienceTags: TargetAudienceTag[];
  likesCount: number;
  createdAt: string;
}
