import { getCurrentUser } from "@/lib/supabase/ssr";
import { getSupabaseAdmin, isSupabaseDbEnabled } from "@/lib/supabase/server";
import { REGISTRATION_SELECT_WITH_NOTES, requireLandingAccess } from "@/lib/followups/access";
import {
  computeFollowupDueDates,
  isFormWindowOpen,
} from "@/lib/followups/dates";
import { clampNotes } from "@/lib/security/sensitive-notes";
import { logAuditEvent } from "@/lib/security/audit";
import type { CompletionStatus } from "@/lib/supabase/types";

type Form2RegItem = {
  id: string;
  completion_status: CompletionStatus | null;
  form2_notes?: string | null;
};

/**
 * GET/PUT form 2 — course ratings + per-registrant completion.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isSupabaseDbEnabled()) {
    return Response.json({ success: false, error: "DB disabled" }, { status: 503 });
  }
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const access = await requireLandingAccess(user, id);
  if ("error" in access) return access.error;

  const dues = computeFollowupDueDates(
    access.landing.start_date,
    access.landing.end_date
  );
  const open = isFormWindowOpen(dues.form2);
  const admin = getSupabaseAdmin();

  const [{ data: regs, error }, { data: followup }] = await Promise.all([
    admin
      .from("registrations")
      .select(REGISTRATION_SELECT_WITH_NOTES)
      .eq("landing_id", id)
      .is("cancelled_at", null)
      .order("created_at", { ascending: true }),
    admin
      .from("landing_followups")
      .select("*")
      .eq("landing_id", id)
      .maybeSingle(),
  ]);

  if (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }

  return Response.json({
    success: true,
    open,
    dueDate: dues.form2?.toISOString().slice(0, 10) ?? null,
    items: regs ?? [],
    followup: followup ?? null,
    landing: {
      id: access.landing.id,
      title: access.landing.course?.title ?? "",
    },
  });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isSupabaseDbEnabled()) {
    return Response.json({ success: false, error: "DB disabled" }, { status: 503 });
  }
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const access = await requireLandingAccess(user, id);
  if ("error" in access) return access.error;

  const dues = computeFollowupDueDates(
    access.landing.start_date,
    access.landing.end_date
  );
  if (!isFormWindowOpen(dues.form2)) {
    return Response.json(
      { success: false, error: "Form 2 window is not open yet" },
      { status: 403 }
    );
  }

  let body: {
    professionalism_rating?: number | null;
    audience_fit_rating?: number | null;
    audience_fit_text?: string | null;
    form2_notes?: string | null;
    items?: Form2RegItem[];
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const now = new Date().toISOString();

  const ratingOk = (n: unknown) =>
    n === null ||
    n === undefined ||
    (typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 5);

  if (!ratingOk(body.professionalism_rating) || !ratingOk(body.audience_fit_rating)) {
    return Response.json(
      { success: false, error: "Ratings must be 1–5 or null" },
      { status: 400 }
    );
  }

  const { error: upsertError } = await admin.from("landing_followups").upsert(
    {
      landing_id: id,
      professionalism_rating: body.professionalism_rating ?? null,
      audience_fit_rating: body.audience_fit_rating ?? null,
      audience_fit_text: clampNotes(body.audience_fit_text),
      form2_notes: clampNotes(body.form2_notes),
      form2_submitted_at: now,
    },
    { onConflict: "landing_id" }
  );

  if (upsertError) {
    return Response.json(
      { success: false, error: upsertError.message },
      { status: 500 }
    );
  }

  const items = Array.isArray(body.items) ? body.items : [];
  const errors: string[] = [];
  for (const item of items) {
    if (!item.id) continue;
    const status = item.completion_status;
    if (status !== null && status !== "completed" && status !== "dropped") {
      errors.push(`${item.id}: invalid status`);
      continue;
    }
    const { error } = await admin
      .from("registrations")
      .update({
        completion_status: status,
        form2_notes: clampNotes(item.form2_notes),
        form2_submitted_at: now,
      })
      .eq("id", item.id)
      .eq("landing_id", id)
      .is("cancelled_at", null);
    if (error) errors.push(`${item.id}: ${error.message}`);
  }

  logAuditEvent({
    actorId: user.id,
    action: "update_notes",
    resourceType: "landing",
    resourceId: id,
    metadata: { form: "form2", count: items.length },
    req,
  });

  if (errors.length) {
    return Response.json(
      { success: false, error: errors.join("; ") },
      { status: 500 }
    );
  }

  return Response.json({ success: true });
}
