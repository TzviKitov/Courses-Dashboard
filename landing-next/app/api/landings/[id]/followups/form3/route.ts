import { getCurrentUser } from "@/lib/supabase/ssr";
import { getSupabaseAdmin, isSupabaseDbEnabled } from "@/lib/supabase/server";
import { REGISTRATION_SELECT_WITH_NOTES, requireLandingAccess } from "@/lib/followups/access";
import {
  computeFollowupDueDates,
  isFormWindowOpen,
} from "@/lib/followups/dates";
import { clampNotes } from "@/lib/security/sensitive-notes";
import { logAuditEvent } from "@/lib/security/audit";

type Form3RegItem = {
  id: string;
  placement_status: boolean | null;
  placement_where?: string | null;
  form3_feedback?: string | null;
  form3_notes?: string | null;
};

/**
 * GET/PUT form 3 — placement + general feedback (course + per registrant).
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
  const open = isFormWindowOpen(dues.form3);
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
    dueDate: dues.form3?.toISOString().slice(0, 10) ?? null,
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
  if (!isFormWindowOpen(dues.form3)) {
    return Response.json(
      { success: false, error: "Form 3 window is not open yet" },
      { status: 403 }
    );
  }

  let body: {
    general_feedback?: string | null;
    form3_notes?: string | null;
    items?: Form3RegItem[];
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { error: upsertError } = await admin.from("landing_followups").upsert(
    {
      landing_id: id,
      general_feedback: clampNotes(body.general_feedback),
      form3_notes: clampNotes(body.form3_notes),
      form3_submitted_at: now,
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
    const { error } = await admin
      .from("registrations")
      .update({
        placement_status:
          typeof item.placement_status === "boolean" ? item.placement_status : null,
        placement_where:
          typeof item.placement_where === "string" ? item.placement_where : null,
        form3_feedback: clampNotes(item.form3_feedback),
        form3_notes: clampNotes(item.form3_notes),
        form3_submitted_at: now,
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
    metadata: { form: "form3", count: items.length },
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
