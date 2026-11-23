export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { userCanManageLanding } from "@/lib/auth/admin";
import { getSupabaseAdmin, isSupabaseDbEnabled } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/ssr";
import { assetPngResponse } from "@/lib/landings/asset-png";
import { parseDownloadKind, pickAssetUrl } from "@/lib/landings/download-assets";

/**
 * GET /api/landings/[id]/download?kind=banner|background
 * Returns the course banner or background image as a PNG file download.
 * Only the owner, co-guides and admins can use it.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  if (!isSupabaseDbEnabled()) {
    return Response.json({ success: false, error: "נדרש Supabase" }, { status: 503 });
  }
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const kind = parseDownloadKind(new URL(req.url).searchParams.get("kind"));
  if (!kind) {
    return Response.json(
      { success: false, error: "kind must be banner or background" },
      { status: 400 }
    );
  }

  const { data: landing } = await getSupabaseAdmin()
    .from("landings")
    .select("owner_id, course, assets")
    .eq("id", id)
    .maybeSingle();
  if (!landing) {
    return Response.json({ success: false, error: "Not found" }, { status: 404 });
  }
  if (!(await userCanManageLanding(user, id, landing.owner_id))) {
    return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const url = pickAssetUrl(landing.assets, kind);
  if (!url) {
    return Response.json({ success: false, error: "אין תמונה כזאת בקורס" }, { status: 404 });
  }
  const title = (landing.course as { title?: string } | null)?.title;
  return assetPngResponse(url, title, kind);
}
