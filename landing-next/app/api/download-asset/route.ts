export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { canCreateCourses } from "@/lib/auth/admin";
import { getCurrentUser } from "@/lib/supabase/ssr";
import { assetPngResponse } from "@/lib/landings/asset-png";
import { parseDownloadKind } from "@/lib/landings/download-assets";

/**
 * GET /api/download-asset?kind=banner|background&url=...&title=...
 * Download an image during course creation (before the course is saved).
 * Only our own public Storage URLs are accepted, and only for people who can create courses.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !canCreateCourses(user)) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const params = new URL(req.url).searchParams;
  const kind = parseDownloadKind(params.get("kind"));
  const url = params.get("url");
  if (!kind || !url) {
    return Response.json({ success: false, error: "kind and url required" }, { status: 400 });
  }
  return assetPngResponse(url, params.get("title") ?? undefined, kind);
}
