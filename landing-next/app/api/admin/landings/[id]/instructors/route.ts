import { requireAdminApi } from "@/lib/admin/require-admin";
import { getProfile } from "@/lib/auth/profiles";
import { getSupabaseAdmin } from "@/lib/supabase/server";

/** List owner + co-instructors for a landing. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  const admin = getSupabaseAdmin();

  const { data: landing, error } = await admin
    .from("landings")
    .select("id, owner_id")
    .eq("id", id)
    .maybeSingle();

  if (error || !landing) {
    return Response.json({ success: false, error: "Not found" }, { status: 404 });
  }

  const { data: co } = await admin
    .from("landing_instructors")
    .select("user_id, created_at")
    .eq("landing_id", id);

  return Response.json({
    success: true,
    ownerId: landing.owner_id,
    instructors: co ?? [],
  });
}

/**
 * Body:
 *  { action: "set_owner", userId }
 *  { action: "add", userId }
 *  { action: "remove", userId }
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  let body: { action?: string; userId?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const userId = body.userId?.trim();
  if (!userId || !body.action) {
    return Response.json(
      { success: false, error: "action and userId required" },
      { status: 400 }
    );
  }

  const profile = await getProfile(userId);
  if (
    !profile ||
    profile.status !== "active" ||
    (profile.role !== "instructor" && profile.role !== "admin")
  ) {
    return Response.json(
      {
        success: false,
        error: "היעד חייב להיות מדריך או מנהל פעיל",
      },
      { status: 400 }
    );
  }

  const admin = getSupabaseAdmin();
  const { data: landing } = await admin
    .from("landings")
    .select("id, owner_id")
    .eq("id", id)
    .maybeSingle();

  if (!landing) {
    return Response.json({ success: false, error: "Not found" }, { status: 404 });
  }

  if (body.action === "set_owner") {
    const { error } = await admin
      .from("landings")
      .update({ owner_id: userId })
      .eq("id", id);
    if (error) {
      return Response.json({ success: false, error: error.message }, { status: 400 });
    }
    // Keep previous owner as co-instructor if different
    if (landing.owner_id && landing.owner_id !== userId) {
      await admin.from("landing_instructors").upsert({
        landing_id: id,
        user_id: landing.owner_id,
        created_by: gate.user.id,
      });
    }
    await admin
      .from("landing_instructors")
      .delete()
      .eq("landing_id", id)
      .eq("user_id", userId);
    return Response.json({ success: true });
  }

  if (body.action === "add") {
    if (landing.owner_id === userId) {
      return Response.json({ success: true, alreadyOwner: true });
    }
    const { error } = await admin.from("landing_instructors").upsert({
      landing_id: id,
      user_id: userId,
      created_by: gate.user.id,
    });
    if (error) {
      return Response.json({ success: false, error: error.message }, { status: 400 });
    }
    return Response.json({ success: true });
  }

  if (body.action === "remove") {
    const { error } = await admin
      .from("landing_instructors")
      .delete()
      .eq("landing_id", id)
      .eq("user_id", userId);
    if (error) {
      return Response.json({ success: false, error: error.message }, { status: 400 });
    }
    return Response.json({ success: true });
  }

  return Response.json({ success: false, error: "Unknown action" }, { status: 400 });
}
