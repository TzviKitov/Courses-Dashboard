import { cookies } from "next/headers";
import { getSupabaseAdmin, isSupabaseDbEnabled } from "@/lib/supabase/server";

const ANON_COOKIE = "lg_anon_id";

async function getOrSetAnonId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(ANON_COOKIE)?.value;
  if (existing) return existing;
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  store.set(ANON_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return id;
}

// GET /api/landings/[id]/likes - return aggregate count + whether the caller liked.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!isSupabaseDbEnabled()) {
    return Response.json({ success: true, count: 0, liked: false });
  }

  const admin = getSupabaseAdmin();
  const anonId = await getOrSetAnonId();

  const [{ count }, { data: mine }] = await Promise.all([
    admin
      .from("likes")
      .select("*", { count: "exact", head: true })
      .eq("landing_id", id),
    admin
      .from("likes")
      .select("identity")
      .eq("landing_id", id)
      .eq("identity", anonId)
      .maybeSingle(),
  ]);

  return Response.json({
    success: true,
    count: count ?? 0,
    liked: Boolean(mine),
  });
}

// POST /api/landings/[id]/likes - toggle like for the caller.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!isSupabaseDbEnabled()) {
    return Response.json(
      { success: false, error: "Likes require Supabase to be enabled." },
      { status: 503 }
    );
  }

  const admin = getSupabaseAdmin();
  const anonId = await getOrSetAnonId();

  // Verify landing exists and is public (cheap pre-check; final guard is FK).
  const { data: landing, error: landingErr } = await admin
    .from("landings")
    .select("id, is_public")
    .eq("id", id)
    .maybeSingle();

  if (landingErr || !landing || !landing.is_public) {
    return Response.json(
      { success: false, error: "Landing not found" },
      { status: 404 }
    );
  }

  // Cheap rate limit: count this anon's likes in the last 60s; if > 10 -> deny.
  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { count: recent } = await admin
    .from("likes")
    .select("*", { count: "exact", head: true })
    .eq("identity", anonId)
    .gte("created_at", oneMinuteAgo);
  if ((recent ?? 0) > 10) {
    return Response.json(
      { success: false, error: "Too many requests" },
      { status: 429 }
    );
  }

  // Check current state to toggle.
  const { data: existing } = await admin
    .from("likes")
    .select("identity")
    .eq("landing_id", id)
    .eq("identity", anonId)
    .maybeSingle();

  if (existing) {
    await admin
      .from("likes")
      .delete()
      .eq("landing_id", id)
      .eq("identity", anonId);
  } else {
    await admin.from("likes").insert({
      landing_id: id,
      identity: anonId,
    });
  }

  const { count } = await admin
    .from("likes")
    .select("*", { count: "exact", head: true })
    .eq("landing_id", id);

  return Response.json({
    success: true,
    count: count ?? 0,
    liked: !existing,
  });
}
