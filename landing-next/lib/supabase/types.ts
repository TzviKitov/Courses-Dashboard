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

export type AcceptanceStatus = "accepted" | "rejected";
export type CompletionStatus = "completed" | "dropped";
export type FormAccessType = "open_pack" | "form1" | "form2" | "form3";
export type EmailOutboxType =
  | "course_open"
  | "form1"
  | "form2"
  | "form3"
  | "reminder_course_open"
  | "reminder_form1"
  | "reminder_form2"
  | "reminder_form3";
export type EmailOutboxStatus = "pending" | "sent" | "failed" | "skipped";

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
  /** ISO date string for course end (nullable; fallback = start + 3 months). */
  end_date: string | null;
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
  partnerLogos?: { id: string; name: string; url: string }[];
}

/** Row stored in the `likes` table. */
export interface LikeRow {
  landing_id: string;
  /** Anonymous cookie ID OR authenticated user_id. */
  identity: string;
  user_id: string | null;
  created_at: string;
}

/** Row stored in the `registrations` table. */
export interface RegistrationRow {
  id: string;
  landing_id: string;
  full_name: string;
  phone: string;
  email: string | null;
  referral: string | null;
  /** Interview availability from public form (not instructor notes). */
  notes: string | null;
  instructor_notes: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  acceptance_status: AcceptanceStatus | null;
  form1_notes: string | null;
  form1_submitted_at: string | null;
  completion_status: CompletionStatus | null;
  form2_notes: string | null;
  form2_submitted_at: string | null;
  placement_status: boolean | null;
  placement_where: string | null;
  form3_feedback: string | null;
  form3_notes: string | null;
  form3_submitted_at: string | null;
  created_at: string;
}

export interface LandingFollowupRow {
  landing_id: string;
  professionalism_rating: number | null;
  audience_fit_rating: number | null;
  audience_fit_text: string | null;
  form2_notes: string | null;
  form2_submitted_at: string | null;
  general_feedback: string | null;
  form3_notes: string | null;
  form3_submitted_at: string | null;
  updated_at: string;
}

export interface RegistrationAttachmentRow {
  id: string;
  registration_id: string;
  landing_id: string;
  file_name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  created_by: string | null;
}

export interface FormAccessTokenRow {
  id: string;
  landing_id: string;
  form_type: FormAccessType;
  token_hash: string;
  expires_at: string;
  created_at: string;
  revoked_at: string | null;
}

export interface EmailOutboxRow {
  id: string;
  landing_id: string;
  email_type: EmailOutboxType;
  recipient: string;
  scheduled_for: string;
  sent_at: string | null;
  reminder_of: string | null;
  status: EmailOutboxStatus;
  error: string | null;
  provider_message_id: string | null;
  created_at: string;
}

/**
 * Filters accepted by GET /api/landings.
 */
export interface LandingsListFilters {
  audience?: TargetAudienceTag;
  sector?: Sector;
  gender?: "men_only" | "women_only" | "everyone";
  courseType?: "one_time" | "training" | "year_round";
  availability?: "open" | "year_round" | "ended" | "open_from";
  /** ISO date - with availability=open_from, or legacy bare from. */
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
