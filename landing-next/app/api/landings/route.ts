import { listLandings } from "@/lib/landings/list-landings";

/**
 * GET /api/landings
 *
 * Query params:
 *   audience   - one TargetAudienceTag value
 *   sector     - one Sector value
 *   from       - ISO date (start_date >= from)
 *   to         - ISO date (start_date <= to)
 *   maxPrice   - number
 *   sort       - "popular" | "recent" | "starting_soon"  (default: recent)
 *   limit      - default 50, max 200
 *   offset     - default 0
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") || "50"), 200);
  const offset = Number(url.searchParams.get("offset") || "0");

  const { items, error } = await listLandings({
    audience: url.searchParams.get("audience") || undefined,
    sector: url.searchParams.get("sector") || undefined,
    from: url.searchParams.get("from") || undefined,
    to: url.searchParams.get("to") || undefined,
    maxPrice: url.searchParams.get("maxPrice") || undefined,
    sort: url.searchParams.get("sort") || "recent",
    limit,
    offset,
  });

  if (error) {
    return Response.json({ success: false, error }, { status: 500 });
  }

  return Response.json({ success: true, items, count: items.length });
}
