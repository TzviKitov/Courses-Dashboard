// Course data schema for the creation flow

export interface Logo {
  id: string;
  name: string;
  url: string;
  tags?: string[];
}

export interface Schedule {
  dates: string;
  days: string;
  time: string;
}

export interface CourseDetails {
  title: string;
  description: string;
  duration: string;
  target_audience: string;
  schedule: Schedule;
  location: string;
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

export type Sector =
  | "education"
  | "welfare"
  | "youth"
  | "community"
  | "tech"
  | "arts"
  | "other";

export interface DashboardMetadata {
  /** ISO date (YYYY-MM-DD), derived from schedule.dates start. Used for filter "starts soon". */
  start_date: string | null;
  /** Price in NIS. null = unknown/free. */
  price: number | null;
  sector: Sector | null;
  target_audience_tags: TargetAudienceTag[];
}

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
  { value: "education", label: "חינוך" },
  { value: "welfare", label: "רווחה" },
  { value: "youth", label: "נוער וקהילה" },
  { value: "community", label: "קהילתי" },
  { value: "tech", label: "טכנולוגיה" },
  { value: "arts", label: "אומנות ותרבות" },
  { value: "other", label: "אחר" },
];

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
    schedule: {
      dates: "",
      days: "",
      time: "",
    },
    location: "",
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
