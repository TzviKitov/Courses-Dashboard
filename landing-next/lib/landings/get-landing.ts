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

/** Load a single landing page by id (no HTTP roundtrip). */
export async function getLandingById(id: string): Promise<LandingPageData | null> {
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
        // #region agent log
        const _dbgMiss = {sessionId:'0fb1a4',location:'lib/landings/get-landing.ts',message:'Supabase fetch miss',data:{id,errorMessage:error.message,source:'direct'},timestamp:Date.now(),hypothesisId:'C'};
        console.log('[DEBUG-0fb1a4]', JSON.stringify(_dbgMiss));
        fetch('http://127.0.0.1:7491/ingest/37669df7-643b-4d57-8969-24bac38a88d8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0fb1a4'},body:JSON.stringify(_dbgMiss)}).catch(()=>{});
        // #endregion
      } else if (data) {
        // #region agent log
        const _dbgHit = {sessionId:'0fb1a4',location:'lib/landings/get-landing.ts',message:'Supabase fetch hit',data:{id,source:'direct'},timestamp:Date.now(),hypothesisId:'C'};
        console.log('[DEBUG-0fb1a4]', JSON.stringify(_dbgHit));
        fetch('http://127.0.0.1:7491/ingest/37669df7-643b-4d57-8969-24bac38a88d8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0fb1a4'},body:JSON.stringify(_dbgHit)}).catch(()=>{});
        // #endregion
        return rowToLandingData(data as LandingRow);
      }
    } catch (error) {
      console.error(`Supabase error fetching landing ${id}:`, error);
    }
  }

  try {
    const filePath = join(process.cwd(), "data", "landings", `${id}.json`);
    const fileContent = await readFile(filePath, "utf-8");
    const landing = JSON.parse(fileContent) as LandingPageData & {
      assets?: { bannerFullUrl?: string; backgroundFullUrl?: string };
    };
    if (landing.assets && !landing.assets.bannerUrl && landing.assets.bannerFullUrl) {
      landing.assets.bannerUrl = landing.assets.bannerFullUrl;
    }
    if (
      landing.assets &&
      !landing.assets.backgroundUrl &&
      landing.assets.backgroundFullUrl
    ) {
      landing.assets.backgroundUrl = landing.assets.backgroundFullUrl;
    }
    return landing;
  } catch {
    console.log(`Landing ${id} not found locally, trying Apps Script...`);
  }

  const base = process.env.APPS_SCRIPT_URL;
  if (!base) {
    // #region agent log
    const _dbg404 = {sessionId:'0fb1a4',location:'lib/landings/get-landing.ts',message:'landing not found',data:{id,dbEnabled:isSupabaseDbEnabled(),source:'direct'},timestamp:Date.now(),hypothesisId:'A'};
    console.log('[DEBUG-0fb1a4]', JSON.stringify(_dbg404));
    fetch('http://127.0.0.1:7491/ingest/37669df7-643b-4d57-8969-24bac38a88d8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0fb1a4'},body:JSON.stringify(_dbg404)}).catch(()=>{});
    // #endregion
    return null;
  }

  const url = new URL(base);
  url.searchParams.set("action", "getLanding");
  url.searchParams.set("id", id);

  try {
    const r = await fetch(url.toString(), { cache: "no-store" });
    const data = await r.json();
    if (!data?.success) return null;
    return data.landing as LandingPageData;
  } catch (error) {
    console.error(`Failed to fetch from Apps Script:`, error);
    return null;
  }
}
