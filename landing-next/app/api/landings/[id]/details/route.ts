import { userCanManageLanding } from "@/lib/auth/admin";
import { getSupabaseAdmin, isSupabaseDbEnabled } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/ssr";
import { applyCourseEdits, type CourseEdits } from "@/lib/landings/edit-course";

/**
 * PATCH /api/landings/[id]/details
 * Edit course text, schedule, price, payment link and visibility after creation.
 * Only fields in CourseEdits are read; everything else stays as stored.
 */
export async function PATCH(
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

  const admin = getSupabaseAdmin();
  const { data: existing } = await admin
    .from("landings")
    .select("owner_id, course, form, is_public, price, start_date, end_date")
    .eq("id", id)
    .maybeSingle();
  if (!existing) {
    return Response.json({ success: false, error: "Not found" }, { status: 404 });
  }
  if (!(await userCanManageLanding(user, id, existing.owner_id))) {
    return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  let edits: CourseEdits;
  try {
    edits = (await req.json()) as CourseEdits;
  } catch {
    return Response.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }
  if (!edits || typeof edits !== "object") {
    return Response.json({ success: false, error: "Invalid body" }, { status: 400 });
  }

  const result = applyCourseEdits(
    {
      course: (existing.course ?? {}) as Record<string, unknown>,
      form: (existing.form ?? {}) as Record<string, unknown>,
      isPublic: existing.is_public,
      price: existing.price === null ? null : Number(existing.price),
      startDate: existing.start_date,
      endDate: existing.end_date,
    },
    edits
  );
  if (!result.ok) {
    return Response.json({ success: false, error: result.error }, { status: 400 });
  }

  const { error } = await admin
    .from("landings")
    .update({
      course: result.value.course,
      form: result.value.form,
      ...result.value.columns,
    })
    .eq("id", id);
  if (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
  return Response.json({ success: true });
}
