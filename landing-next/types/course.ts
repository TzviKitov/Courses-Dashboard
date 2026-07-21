// Course data schema for the creation flow

export interface Logo {
  id: string;
  name: string;
  url: string;
  tags?: string[];
}

export interface Schedule {
  /** ISO date YYYY-MM-DD — program open/start date */
  start_date: string;
  /** ISO date YYYY-MM-DD — estimated end; empty = open for the year */
  end_date: string;
  /** ISO date YYYY-MM-DD — interviews / acceptance decision (secondary) */
  interview_date: string;
  days: string;
  /** Optional hours, e.g. "16:00-18:00" */
  time: string;
  /**
   * Legacy combined display string ("start - end").
   * Kept for banner/landing compatibility; derived when saving.
   */
  dates?: string;
}

export type CourseType = "ongoing" | "one_time" | "annual";

export type GenderSeparation = "men_only" | "women_only" | "everyone";

/** Community / audience sector shown on landings (extensible). */
export type Sector = "haredi" | "east_jerusalem" | "general";

/** Primary audience category for create flow (extensible). */
export type AudienceCategory = "youth" | "young_adults";

export interface CourseDetails {
  title: string;
  description: string;
  duration: string;
  /** Display label derived from audience category, e.g. "נוער" */
  target_audience: string;
  audience_category: AudienceCategory | "";
  schedule: Schedule;
  location: string;
  instructor_name: string;
  organization: string;
  role: string;
  contact_phone: string;
  contact_email: string;
  course_type: CourseType | "";
  age_range: string;
  sector: Sector | "";
  gender_separation: GenderSeparation | "";
}

export interface DesignPreferences {
  size: string;
  aesthetic_style: string;
  color_palette: string;
  lighting_and_atmosphere: string;
  typography_style: string;
  composition: string;
  visual_inspiration: string;
  // Art direction fields
  visual_style: 'photorealistic' | 'three_d_render' | 'vector_flat' | 'abstract_tech' | 'hand_drawn';
  composition_rule: 'text_center' | 'text_side_negative_space' | 'knolling' | 'rule_of_thirds' | 'bento_grid';
  lighting_mood: 'golden_hour' | 'soft_studio' | 'neon_cyberpunk' | 'rembrandt' | 'natural_bright';
  color_mood: 'corporate' | 'creative_vibrant' | 'luxury_dark' | 'pastel_soft' | 'monochromatic';
}

export interface ThemeColors {
  primary?: string;
  accent?: string;
  background?: string;
  text?: string;
  palette?: string[];
}

export interface Branding {
  logo: Logo | null; // Deprecated - use logos instead
  logos: Logo[]; // Up to 3 logos for banner integration
  theme: {
    theme_id: string;
    font_stack_id: string;
    palette_id: string;
    mode: "light" | "dark";
    colors?: ThemeColors;
    font_family?: string; // Hebrew font from Google Fonts
    overrides: {
      primary: string | null;
      accent: string | null;
    };
  };
}

export interface GeneratedAssets {
  banner_url?: string;
  banner_thumb_url?: string;
  background_url?: string;
  background_thumb_url?: string;
  /**
   * sessionId returned by api/banner. Used by api/create-landing to move
   * Storage files from tmp/{sessionId}/ -> courses/{landingId}/.
   */
  session_id?: string;
}

export interface LandingConfig {
  extended_description: string;
  requires_interview: boolean;
  referral_options: string[];
  /** Free-text FAQ shown on the landing page (optional). */
  faq_text?: string;
  /** Free-text syllabus / program steps (optional). */
  syllabus_text?: string;
  /** When true, banner logos are also shown as partner logos on the landing. */
  show_partner_logos?: boolean;
  /** External payment URL for a CTA on the landing (optional). */
  payment_link?: string;
}

/** Structured filter metadata for dashboard discoverability. */
export type TargetAudienceTag =
  | "youth"
  | "young_adults"
  | "adults"
  | "seniors"
  | "parents"
  | "professionals"
  | "students"
  | "general";

export interface DashboardMetadata {
  /** ISO date (YYYY-MM-DD), derived from schedule.start_date. */
  start_date: string | null;
  /** Price in NIS. null = unknown/free. */
  price: number | null;
  sector: Sector | null;
  target_audience_tags: TargetAudienceTag[];
  course_type?: CourseType | null;
  gender_separation?: GenderSeparation | null;
}

export const COURSE_TYPE_OPTIONS: { value: CourseType; label: string }[] = [
  { value: "ongoing", label: "קורס מתמשך" },
  { value: "one_time", label: "אירוע חד פעמי" },
  { value: "annual", label: "קורס שנתי" },
];

export const AUDIENCE_CATEGORY_OPTIONS: {
  value: AudienceCategory;
  label: string;
  tag: TargetAudienceTag;
}[] = [
  { value: "youth", label: "נוער", tag: "youth" },
  { value: "young_adults", label: "צעירים", tag: "young_adults" },
];

export const GENDER_SEPARATION_OPTIONS: {
  value: GenderSeparation;
  label: string;
}[] = [
  { value: "men_only", label: "רק גברים" },
  { value: "women_only", label: "רק נשים" },
  { value: "everyone", label: "כולם" },
];

export const TARGET_AUDIENCE_OPTIONS: { value: TargetAudienceTag; label: string }[] = [
  { value: "youth", label: "נוער" },
  { value: "young_adults", label: "צעירים" },
  { value: "adults", label: "מבוגרים" },
  { value: "seniors", label: "גיל הזהב" },
  { value: "parents", label: "הורים" },
  { value: "professionals", label: "אנשי מקצוע" },
  { value: "students", label: "סטודנטים" },
  { value: "general", label: "כללי" },
];

export const SECTOR_OPTIONS: { value: Sector; label: string }[] = [
  { value: "haredi", label: "חרדים" },
  { value: "east_jerusalem", label: "מזרח העיר" },
  { value: "general", label: "כללי" },
];

/** Build legacy `schedule.dates` display string from structured dates. */
export function formatScheduleDates(start: string, end: string): string {
  const s = start.trim();
  const e = end.trim();
  if (s && e) return `${s} - ${e}`;
  return s || e || "";
}

/** Migrate older localStorage shapes into the current CourseDetails schedule. */
export function normalizeSchedule(raw: Partial<Schedule> | undefined): Schedule {
  const start =
    raw?.start_date ||
    (typeof raw?.dates === "string" ? raw.dates.split(" - ")[0]?.trim() : "") ||
    "";
  const end =
    raw?.end_date ||
    (typeof raw?.dates === "string" ? raw.dates.split(" - ")[1]?.trim() : "") ||
    "";
  return {
    start_date: start,
    end_date: end,
    interview_date: raw?.interview_date || "",
    days: raw?.days || "",
    time: raw?.time || "",
    dates: formatScheduleDates(start, end) || raw?.dates || "",
  };
}

export interface CourseData {
  course_details: CourseDetails;
  design_preferences: DesignPreferences;
  branding: Branding;
  generated_assets: GeneratedAssets;
  landing_config?: LandingConfig;
  metadata?: DashboardMetadata;
}

// Default values for creating a new course
export const defaultCourseData: CourseData = {
  course_details: {
    title: "",
    description: "",
    duration: "",
    target_audience: "",
    audience_category: "",
    schedule: {
      start_date: "",
      end_date: "",
      interview_date: "",
      days: "",
      time: "",
      dates: "",
    },
    location: "",
    instructor_name: "",
    organization: "",
    role: "",
    contact_phone: "",
    contact_email: "",
    course_type: "",
    age_range: "",
    sector: "",
    gender_separation: "",
  },
  design_preferences: {
    size: "instagram_story",
    aesthetic_style: "modern_tech",
    color_palette: "light_airy",
    lighting_and_atmosphere: "natural_light",
    typography_style: "modern_sans",
    composition: "balanced",
    visual_inspiration: "",
    // Art direction defaults
    visual_style: "photorealistic",
    composition_rule: "text_center",
    lighting_mood: "soft_studio",
    color_mood: "corporate",
  },
  branding: {
    logo: null, // Deprecated
    logos: [],
    theme: {
      theme_id: "courseflow_light_mint",
      font_stack_id: "inter_noto",
      palette_id: "mint",
      mode: "light",
      font_family: "Heebo",
      overrides: {
        primary: null,
        accent: null,
      },
    },
  },
  generated_assets: {},
};
