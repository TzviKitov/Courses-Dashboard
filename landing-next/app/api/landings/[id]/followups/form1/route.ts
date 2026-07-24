import { getCurrentUser } from "@/lib/supabase/ssr";
import { getSupabaseAdmin, isSupabaseDbEnabled } from "@/lib/supabase/server";
import { REGISTRATION_SELECT, requireLandingAccess } from "@/lib/followups/access";
import {
  computeFollowupDueDates,
  isFormWindowOpen,
} from "@/lib/followups/dates";
import type { AcceptanceStatus } from "@/lib/supabase/types";

type Form1Item = {
  id: string;
  acceptance_status: AcceptanceStatus | null;
  form1_notes?: string | null;
};

/**
 * GET/PUT form 1 — acceptance + notes per registrant.
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
  const open = isFormWindowOpen(dues.form1);

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("registrations")
    .select(REGISTRATION_SELECT)
    .eq("landing_id", id)
    .is("cancelled_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }

  const { data: attachments } = await admin
    .from("registration_attachments")
    .select("*")
    .eq("landing_id", id);

  return Response.json({
    success: true,
    open,
    dueDate: dues.form1?.toISOString().slice(0, 10) ?? null,
    items: data ?? [],
    attachments: attachments ?? [],
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
  if (!isFormWindowOpen(dues.form1)) {
    return Response.json(
      { success: false, error: "Form 1 window is not open yet" },
      { status: 403 }
    );
  }

  let body: { items?: Form1Item[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) {
    return Response.json({ success: false, error: "items required" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const now = new Date().toISOString();
  const errors: string[] = [];

  for (const item of items) {
    if (!item.id) continue;
    const status = item.acceptance_status;
    if (status !== null && status !== "accepted" && status !== "rejected") {
      errors.push(`${item.id}: invalid status`);
      continue;
    }
    const notes =
      typeof item.form1_notes === "string" ? item.form1_notes : null;
    const { error } = await admin
      .from("registrations")
      .update({
        acceptance_status: status,
        form1_notes: notes,
        form1_submitted_at: now,
      })
      .eq("id", item.id)
      .eq("landing_id", id)
      .is("cancelled_at", null);

    if (error) errors.push(`${item.id}: ${error.message}`);
  }

  if (errors.length) {
    return Response.json(
      { success: false, error: errors.join("; ") },
      { status: 500 }
    );
  }

  return Response.json({ success: true });
}
