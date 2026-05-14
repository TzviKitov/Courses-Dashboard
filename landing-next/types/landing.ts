// Landing page data schema
// This contract is shared between Flask backend and Next.js frontend

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

export interface LandingPageData {
  id: string;

  // Course information
  course: {
    title: string;
    description: string;
    extendedDescription?: string;
    schedule: {
      dates?: string;
      time?: string;
      days?: string;
    };
    location?: string;
    duration?: string;
    targetAudience?: string;
  };

  // Visual assets - URLs only (Supabase Storage). No base64.
  assets: {
    backgroundUrl?: string;
    bannerUrl?: string;
    backgroundThumbUrl?: string;
    bannerThumbUrl?: string;
  };

  // Theme/colors (extracted from banner)
  theme?: {
    primary?: string;
    accent?: string;
    fontFamily?: string;
  };

  // Registration form configuration
  form: {
    requiresInterview: boolean;
    referralOptions: string[];
  };

  // Structured metadata for dashboard filtering
  metadata?: {
    startDate?: string | null;
    price?: number | null;
    sector?: Sector | null;
    targetAudienceTags?: TargetAudienceTag[];
  };

  // Aggregates from DB
  likesCount?: number;

  // Metadata
  createdAt?: string;
}

// API response wrapper
export interface LandingApiResponse {
  success: boolean;
  data?: LandingPageData;
  error?: string;
}
