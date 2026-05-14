import { readFile } from "fs/promises";
import { join } from "path";
import { getSupabaseAdmin, isSupabaseDbEnabled } from "@/lib/supabase/server";
import type { LandingRow } from "@/lib/supabase/types";
import type { LandingPageData } from "@/types/landing";

function rowToLandingData(row: LandingRow): LandingPageData {
  return {
    id: row.id,
    course: row.course,
    assets: {
      bannerUrl: row.assets.bannerFullUrl,
      backgroundUrl: row.assets.backgroundFullUrl,
    },
    theme: row.theme,
    form: row.form,
    createdAt: row.created_at,
  };
}

// GET /api/landing/[id]
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Primary path: Supabase DB (Wave 1+).
  if (isSupabaseDbEnabled()) {
    try {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin
        .from("landings")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.warn(`Supabase landing fetch failed for ${id}:`, error.message);
      } else if (data) {
        return Response.json(rowToLandingData(data as LandingRow));
      }
    } catch (error) {
      console.error(`Supabase error fetching landing ${id}:`, error);
    }
  }

  // Fallback 1: local JSON file (dev mode only - filesystem is ephemeral on Vercel).
  try {
    const filePath = join(process.cwd(), "data", "landings", `${id}.json`);
    const fileContent = await readFile(filePath, "utf-8");
    const landing = JSON.parse(fileContent);
    // Normalize: older files may use legacy keys.
    if (landing.assets && !landing.assets.bannerUrl && landing.assets.bannerFullUrl) {
      landing.assets.bannerUrl = landing.assets.bannerFullUrl;
    }
    if (landing.assets && !landing.assets.backgroundUrl && landing.assets.backgroundFullUrl) {
      landing.assets.backgroundUrl = landing.assets.backgroundFullUrl;
    }
    console.log(`Loaded landing from local file: ${id}`);
    return Response.json(landing);
  } catch {
    console.log(`Landing ${id} not found locally, trying Apps Script...`);
  }

  // Fallback 2: legacy Apps Script (will be removed in Wave 3).
  const base = process.env.APPS_SCRIPT_URL;
  if (!base) {
    return new Response("Not Found", { status: 404 });
  }

  const url = new URL(base);
  url.searchParams.set("action", "getLanding");
  url.searchParams.set("id", id);

  try {
    const r = await fetch(url.toString(), { cache: "no-store" });
    const data = await r.json();
    if (!data?.success) {
      return new Response("Not Found", { status: 404 });
    }
    return Response.json(data.landing);
  } catch (error) {
    console.error(`Failed to fetch from Apps Script:`, error);
    return new Response("Not Found", { status: 404 });
  }
}
