import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import {
  moveStoragePrefix,
  rewriteStorageUrl,
} from "@/lib/supabase/storage";
import { logUsageEvent } from "@/lib/admin/log-usage";
import {
  getSupabaseAdmin,
  isSupabaseConfigured,
  isSupabaseDbEnabled,
} from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/ssr";
import { getServerBaseUrlFromRequest } from "@/lib/server-base-url";
import type {
  LandingAssets,
  TargetAudienceTag,
  Sector,
} from "@/lib/supabase/types";

const VALID_AUDIENCE_TAGS = new Set<TargetAudienceTag>([
  "youth",
  "young_adults",
  "adults",
  "seniors",
  "parents",
  "professionals",
  "students",
  "general",
]);

const VALID_SECTORS = new Set<Sector>([
  "haredi",
  "east_jerusalem",
  "general",
]);

const VALID_COURSE_TYPES = new Set(["ongoing", "one_time", "annual"]);
const VALID_GENDER = new Set(["men_only", "women_only", "everyone"]);

function normalizeSector(value: unknown): Sector | null {
  if (typeof value !== "string" || !value) return null;
  return VALID_SECTORS.has(value as Sector) ? (value as Sector) : null;
}

function normalizeOptionalEnum(
  value: unknown,
  allowed: Set<string>
): string | null {
  if (typeof value !== "string" || !value) return null;
  return allowed.has(value) ? value : null;
}

function formatScheduleDates(start?: string, end?: string): string {
  const s = (start || "").trim();
  const e = (end || "").trim();
  if (s && e) return `${s} - ${e}`;
  return s || e || "";
}

function normalizeAudienceTags(value: unknown): TargetAudienceTag[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (tag): tag is TargetAudienceTag =>
      typeof tag === "string" && VALID_AUDIENCE_TAGS.has(tag as TargetAudienceTag)
  );
}

function normalizePrice(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function normalizeStartDate(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

interface CourseData {
  course_details?: {
    title?: string;
    description?: string;
    schedule?: {
      start_date?: string;
      end_date?: string;
      interview_date?: string;
      dates?: string;
      time?: string;
      days?: string;
    };
    location?: string;
    duration?: string;
    target_audience?: string;
    audience_category?: string;
    instructor_name?: string;
    organization?: string;
    role?: string;
    contact_phone?: string;
    contact_email?: string;
    course_type?: string;
    age_range?: string;
    sector?: string;
    gender_separation?: string;
  };
  generated_assets?: {
    banner_url?: string;
    banner_thumb_url?: string;
    background_url?: string;
    background_thumb_url?: string;
    /** sessionId returned by api/banner; used to move tmp/ -> courses/{id}/. */
    session_id?: string;
  };
  branding?: {
    logo?: {
      id?: string;
      name?: string;
      url?: string;
    };
    theme?: {
      font_family?: string;
      colors?: {
        primary?: string;
        accent?: string;
      };
    };
  };
  landing_config?: {
    extended_description?: string;
    requires_interview?: boolean;
    referral_options?: string[];
  };
  /** Optional structured filter metadata (Wave 1+). */
  metadata?: {
    start_date?: string;
    price?: number | null;
    sector?: Sector | null;
    target_audience_tags?: TargetAudienceTag[];
    course_type?: string | null;
    gender_separation?: string | null;
  };
}

function generateLandingId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

/**
 * Reject any URL that looks like base64 or a blob URL - those should never
 * be persisted server-side anymore (Wave 0 hardening).
 */
function isPersistableUrl(url: string | undefined | null): url is string {
  if (!url) return false;
  if (url.startsWith("data:")) return false;
  if (url.startsWith("blob:")) return false;
  return true;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const courseData: CourseData = body.courseData || {};

    console.log("=== CREATE LANDING PAGE ===");

    const landingId = generateLandingId();

    const details = courseData.course_details || {};
    const assets = courseData.generated_assets || {};
    const branding = courseData.branding || {};
    const landingConfig = courseData.landing_config || {};
    const colors = branding.theme?.colors || {};
    const metadata = courseData.metadata || {};

    const fontFamily = branding.theme?.font_family || "Heebo";

    // Move banner/hero files from tmp/{sessionId} to courses/{landingId}/
    // and rewrite the URLs to point at the new location.
    let finalAssets: LandingAssets = {};
    if (assets.session_id && isSupabaseConfigured()) {
      const fromPrefix = `tmp/${assets.session_id}`;
      const toPrefix = `courses/${landingId}`;
      const moveResult = await moveStoragePrefix(fromPrefix, toPrefix);
      if (moveResult.errors.length > 0) {
        console.warn("Storage move had errors:", moveResult.errors);
      }
      finalAssets = {
        bannerFullUrl: rewriteStorageUrl(assets.banner_url, fromPrefix, toPrefix),
        bannerThumbUrl: rewriteStorageUrl(assets.banner_thumb_url, fromPrefix, toPrefix),
        backgroundFullUrl: rewriteStorageUrl(assets.background_url, fromPrefix, toPrefix),
        backgroundThumbUrl: rewriteStorageUrl(assets.background_thumb_url, fromPrefix, toPrefix),
      };
    } else {
      // Accept already-final URLs (e.g. legacy data), but reject base64/blob.
      finalAssets = {
        bannerFullUrl: isPersistableUrl(assets.banner_url) ? assets.banner_url : undefined,
        bannerThumbUrl: isPersistableUrl(assets.banner_thumb_url) ? assets.banner_thumb_url : undefined,
        backgroundFullUrl: isPersistableUrl(assets.background_url) ? assets.background_url : undefined,
        backgroundThumbUrl: isPersistableUrl(assets.background_thumb_url) ? assets.background_thumb_url : undefined,
      };
    }

    const startDate =
      details.schedule?.start_date ||
      (typeof details.schedule?.dates === "string"
        ? details.schedule.dates.split(" - ")[0]?.trim()
        : "") ||
      "";
    const endDate =
      details.schedule?.end_date ||
      (typeof details.schedule?.dates === "string"
        ? details.schedule.dates.split(" - ")[1]?.trim()
        : "") ||
      "";
    const datesDisplay =
      details.schedule?.dates || formatScheduleDates(startDate, endDate);

    const courseSector =
      normalizeSector(details.sector) || normalizeSector(metadata.sector);
    const courseType =
      normalizeOptionalEnum(details.course_type, VALID_COURSE_TYPES) ||
      normalizeOptionalEnum(metadata.course_type, VALID_COURSE_TYPES);
    const genderSeparation =
      normalizeOptionalEnum(details.gender_separation, VALID_GENDER) ||
      normalizeOptionalEnum(metadata.gender_separation, VALID_GENDER);

    const courseRecord = {
      title: details.title || "",
      description: details.description || "",
      extendedDescription: landingConfig.extended_description || "",
      schedule: {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        interviewDate: details.schedule?.interview_date || undefined,
        dates: datesDisplay || undefined,
        time: details.schedule?.time || undefined,
        days: details.schedule?.days || undefined,
      },
      location: details.location || "",
      duration: details.duration || "",
      targetAudience: details.target_audience || "",
      audienceCategory: details.audience_category || undefined,
      ageRange: details.age_range || undefined,
      sector: courseSector || undefined,
      genderSeparation: genderSeparation || undefined,
      courseType: courseType || undefined,
      instructorName: details.instructor_name || undefined,
      organization: details.organization || undefined,
      role: details.role || undefined,
      contactPhone: details.contact_phone || undefined,
      contactEmail: details.contact_email || undefined,
    };

    const themeRecord = {
      primary: colors.primary || "#13ecda",
      accent: colors.accent || "#1a1a2e",
      fontFamily,
    };

    const formRecord = {
      requiresInterview: landingConfig.requires_interview || false,
      referralOptions: landingConfig.referral_options || [
        "חבר/ה",
        "פייסבוק",
        "גוגל",
        "אחר",
      ],
    };

    // Primary path: Supabase DB (Wave 1+). Attach owner_id if a user is signed in.
    let savedToDb = false;
    let saveError: string | null = null;
    if (isSupabaseDbEnabled()) {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        return NextResponse.json(
          { success: false, error: "Unauthorized" },
          { status: 401 }
        );
      }

      const admin = getSupabaseAdmin();
      const { error } = await admin.from("landings").insert({
        id: landingId,
        course: courseRecord,
        assets: finalAssets,
        theme: themeRecord,
        form: formRecord,
        owner_id: currentUser.id,
        is_public: true,
        start_date: normalizeStartDate(metadata.start_date || startDate),
        price: normalizePrice(metadata.price),
        sector: courseSector,
        target_audience_tags: normalizeAudienceTags(metadata.target_audience_tags),
      });
      if (error) {
        saveError = error.message;
        console.error("Supabase insert failed:", error);
      } else {
        savedToDb = true;
        console.log(
          `Inserted landing into Supabase: ${landingId} (owner: ${currentUser?.id ?? "anonymous"})`
        );
        await logUsageEvent({
          eventType: "landing_created",
          userId: currentUser.id,
          landingId,
          sessionId: body.sessionId ?? null,
        });
      }
    }

    // Fallback: local JSON file — ONLY for genuine local dev without Supabase DB.
    // In production this path is forbidden: files written to a serverless
    // filesystem are ephemeral, so /l/<id> would 404 on the next request and
    // silently mask a misconfiguration (missing USE_SUPABASE_DB / service role).
    let savedLocally = false;
    if (!savedToDb && !isSupabaseDbEnabled()) {
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json(
          {
            success: false,
            error:
              "Server misconfiguration: Supabase database mode is disabled. " +
              "Set USE_SUPABASE_DB=true and SUPABASE_SERVICE_ROLE_KEY in the " +
              "environment, then redeploy.",
          },
          { status: 500 }
        );
      }

      const localLandingData = {
        id: landingId,
        course: courseRecord,
        assets: {
          backgroundUrl: finalAssets.backgroundFullUrl || "",
          backgroundThumbUrl: finalAssets.backgroundThumbUrl || "",
          bannerUrl: finalAssets.bannerFullUrl || "",
          bannerThumbUrl: finalAssets.bannerThumbUrl || "",
        },
        theme: themeRecord,
        form: formRecord,
        metadata: {
          start_date: metadata.start_date || startDate || null,
          price: metadata.price ?? null,
          sector: courseSector,
          target_audience_tags: metadata.target_audience_tags ?? [],
          course_type: courseType,
          gender_separation: genderSeparation,
        },
        createdAt: new Date().toISOString(),
      };

      try {
        const dataDir = join(process.cwd(), "data", "landings");
        await mkdir(dataDir, { recursive: true });
        const filePath = join(dataDir, `${landingId}.json`);
        await writeFile(filePath, JSON.stringify(localLandingData, null, 2));
        console.log(`Saved landing locally: ${filePath}`);
        savedLocally = true;
      } catch (error) {
        console.error("Failed to save landing locally:", error);
        if (!saveError) {
          saveError = error instanceof Error ? error.message : "Local save failed";
        }
      }
    }

    // Legacy: keep Apps Script in the loop if configured (Wave 3 will replace).
    const appsScriptUrl = process.env.APPS_SCRIPT_URL;
    if (appsScriptUrl) {
      try {
        const response = await fetch(appsScriptUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "createLanding",
            id: landingId,
            course: courseRecord,
            assets: {
              backgroundUrl: finalAssets.backgroundFullUrl || "",
              bannerUrl: finalAssets.bannerFullUrl || "",
            },
            theme: themeRecord,
            form: formRecord,
          }),
        });
        const result = await response.json();
        if (!result.success) {
          console.error("Apps Script error:", result);
        }
      } catch (error) {
        console.error("Failed to send to Apps Script:", error);
      }
    }

    if (isSupabaseDbEnabled() && !savedToDb) {
      return NextResponse.json(
        {
          success: false,
          error: saveError || "Failed to save landing to database",
        },
        { status: 500 }
      );
    }

    if (!isSupabaseDbEnabled() && !savedLocally) {
      return NextResponse.json(
        {
          success: false,
          error: saveError || "Failed to save landing",
        },
        { status: 500 }
      );
    }

    const baseUrl = getServerBaseUrlFromRequest(req);
    return NextResponse.json({
      success: true,
      landingId,
      url: `${baseUrl}/l/${landingId}`,
    });
  } catch (error) {
    console.error("Error creating landing page:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
