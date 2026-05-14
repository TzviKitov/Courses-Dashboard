import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import {
  moveStoragePrefix,
  rewriteStorageUrl,
} from "@/lib/supabase/storage";
import {
  getSupabaseAdmin,
  isSupabaseConfigured,
  isSupabaseDbEnabled,
} from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/ssr";
import type {
  LandingAssets,
  TargetAudienceTag,
  Sector,
} from "@/lib/supabase/types";

interface CourseData {
  course_details?: {
    title?: string;
    description?: string;
    schedule?: {
      dates?: string;
      time?: string;
      days?: string;
    };
    location?: string;
    duration?: string;
    target_audience?: string;
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

    const courseRecord = {
      title: details.title || "",
      description: details.description || "",
      extendedDescription: landingConfig.extended_description || "",
      schedule: details.schedule || {},
      location: details.location || "",
      duration: details.duration || "",
      targetAudience: details.target_audience || "",
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
    if (isSupabaseDbEnabled()) {
      const admin = getSupabaseAdmin();
      const currentUser = await getCurrentUser();
      const { error } = await admin.from("landings").insert({
        id: landingId,
        course: courseRecord,
        assets: finalAssets,
        theme: themeRecord,
        form: formRecord,
        owner_id: currentUser?.id ?? null,
        is_public: true,
        start_date: metadata.start_date || null,
        price: metadata.price ?? null,
        sector: metadata.sector ?? null,
        target_audience_tags: metadata.target_audience_tags ?? [],
      });
      if (error) {
        console.error("Supabase insert failed:", error);
      } else {
        savedToDb = true;
        console.log(
          `Inserted landing into Supabase: ${landingId} (owner: ${currentUser?.id ?? "anonymous"})`
        );
      }
    }

    // Fallback: local JSON file (dev mode and before USE_SUPABASE_DB=true).
    if (!savedToDb) {
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
          start_date: metadata.start_date || null,
          price: metadata.price ?? null,
          sector: metadata.sector ?? null,
          target_audience_tags: metadata.target_audience_tags ?? [],
        },
        createdAt: new Date().toISOString(),
      };

      try {
        const dataDir = join(process.cwd(), "data", "landings");
        await mkdir(dataDir, { recursive: true });
        const filePath = join(dataDir, `${landingId}.json`);
        await writeFile(filePath, JSON.stringify(localLandingData, null, 2));
        console.log(`Saved landing locally: ${filePath}`);
      } catch (error) {
        console.error("Failed to save landing locally:", error);
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

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
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
