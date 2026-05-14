import { getSupabaseAdmin, isSupabaseDbEnabled } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/ssr";

/**
 * PATCH /api/landings/[id] - Owner-only update of mutable course fields.
 * Accepts a subset of: course, theme, form, is_public, start_date, price, sector, target_audience_tags.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!isSupabaseDbEnabled()) {
    return Response.json(
      { success: false, error: "Editing requires Supabase to be enabled." },
      { status: 503 }
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const { data: existing, error: fetchError } = await admin
    .from("landings")
    .select("owner_id")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !existing) {
    return Response.json({ success: false, error: "Not found" }, { status: 404 });
  }

  if (existing.owner_id !== user.id) {
    return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const update: Record<string, unknown> = {};
  const allowed = [
    "course",
    "theme",
    "form",
    "is_public",
    "start_date",
    "price",
    "sector",
    "target_audience_tags",
  ];
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }

  if (Object.keys(update).length === 0) {
    return Response.json({ success: false, error: "No updatable fields" }, { status: 400 });
  }

  const { error: updateError } = await admin
    .from("landings")
    .update(update)
    .eq("id", id);

  if (updateError) {
    return Response.json(
      { success: false, error: updateError.message },
      { status: 500 }
    );
  }

  return Response.json({ success: true });
}

/**
 * DELETE /api/landings/[id] - Owner-only delete.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!isSupabaseDbEnabled()) {
    return Response.json(
      { success: false, error: "Deletion requires Supabase to be enabled." },
      { status: 503 }
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const { data: existing, error: fetchError } = await admin
    .from("landings")
    .select("owner_id")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !existing) {
    return Response.json({ success: false, error: "Not found" }, { status: 404 });
  }

  if (existing.owner_id !== user.id) {
    return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { error: deleteError } = await admin
    .from("landings")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return Response.json(
      { success: false, error: deleteError.message },
      { status: 500 }
    );
  }

  return Response.json({ success: true });
}
