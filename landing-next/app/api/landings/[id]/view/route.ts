import { createHash } from "node:crypto";
import { getSupabaseAdmin, isSupabaseDbEnabled } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/ssr";

const MAX_VIEWS_PER_VIEWER_PER_LANDING_PER_DAY = 30;

function viewerKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || req.headers.get("x-real-ip") || "unknown";
  const ua = req.headers.get("user-agent") || "";
  return createHash("sha256").update(`${ip}|${ua}`).digest("hex").slice(0, 32);
}

/**
 * POST /api/landings/[id]/view — record a landing page view (deduped per viewer per day).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: landingId } = await params;

  if (!isSupabaseDbEnabled()) {
    return Response.json({ success: true, skipped: true });
  }

  const admin = getSupabaseAdmin();

  const { data: landing } = await admin
    .from("landings")
    .select("id")
    .eq("id", landingId)
    .maybeSingle();

  if (!landing) {
    return Response.json({ success: false, error: "Not found" }, { status: 404 });
  }

  const key = viewerKey(req);
  const viewedDateUtc = new Date().toISOString().slice(0, 10);

  const { count } = await admin
    .from("landing_views")
    .select("id", { count: "exact", head: true })
    .eq("landing_id", landingId)
    .eq("viewer_key", key)
    .eq("viewed_date_utc", viewedDateUtc);

  if ((count ?? 0) >= MAX_VIEWS_PER_VIEWER_PER_LANDING_PER_DAY) {
    return Response.json({ success: true, deduped: true });
  }

  const user = await getCurrentUser();

  const { error } = await admin.from("landing_views").insert({
    landing_id: landingId,
    viewer_key: key,
    user_id: user?.id ?? null,
  });

  if (error) {
    console.warn("landing_views insert:", error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}
