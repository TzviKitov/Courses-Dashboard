import { getSupabaseAdmin } from "@/lib/supabase/server";
import { REGISTRATION_SELECT_WITH_NOTES } from "@/lib/followups/access";
import {
  computeFollowupDueDates,
  isFormWindowOpen,
} from "@/lib/followups/dates";
import { requireFormToken } from "@/lib/followups/tokens";
import { ATTACHMENT_LIST_SELECT, clampNotes } from "@/lib/security/sensitive-notes";
import { logAuditEvent } from "@/lib/security/audit";
import type { AcceptanceStatus } from "@/lib/supabase/types";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const auth = await requireFormToken(token, "form1");
  if ("error" in auth) return auth.error;

  const admin = getSupabaseAdmin();
  const { data: landing } = await admin
    .from("landings")
    .select("id, course, start_date, end_date")
    .eq("id", auth.landingId)
    .maybeSingle();
  if (!landing) {
    return Response.json({ success: false, error: "Not found" }, { status: 404 });
  }

  const dues = computeFollowupDueDates(landing.start_date, landing.end_date);
  const { data: items } = await admin
    .from("registrations")
    .select(REGISTRATION_SELECT_WITH_NOTES)
    .eq("landing_id", auth.landingId)
    .is("cancelled_at", null)
    .order("created_at", { ascending: true });
  const { data: attachments } = await admin
    .from("registration_attachments")
    .select(ATTACHMENT_LIST_SELECT)
    .eq("landing_id", auth.landingId);

  return Response.json({
    success: true,
    open: isFormWindowOpen(dues.form1),
    dueDate: dues.form1?.toISOString().slice(0, 10) ?? null,
    items: items ?? [],
    attachments: attachments ?? [],
    landing: {
      id: landing.id,
      title: (landing.course as { title?: string })?.title ?? "",
    },
  });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const auth = await requireFormToken(token, "form1");
  if ("error" in auth) return auth.error;

  const admin = getSupabaseAdmin();
  const { data: landing } = await admin
    .from("landings")
    .select("start_date, end_date")
    .eq("id", auth.landingId)
    .maybeSingle();
  if (!landing) {
    return Response.json({ success: false, error: "Not found" }, { status: 404 });
  }
  const dues = computeFollowupDueDates(landing.start_date, landing.end_date);
  if (!isFormWindowOpen(dues.form1)) {
    return Response.json(
      { success: false, error: "Form 1 window is not open yet" },
      { status: 403 }
    );
  }

  let body: {
    items?: {
      id: string;
      acceptance_status: AcceptanceStatus | null;
      form1_notes?: string | null;
    }[];
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const now = new Date().toISOString();
  for (const item of body.items ?? []) {
    if (!item.id) continue;
    await admin
      .from("registrations")
      .update({
        acceptance_status: item.acceptance_status,
        form1_notes: clampNotes(item.form1_notes),
        form1_submitted_at: now,
      })
      .eq("id", item.id)
      .eq("landing_id", auth.landingId)
      .is("cancelled_at", null);
  }

  logAuditEvent({
    action: "update_notes",
    resourceType: "landing",
    resourceId: auth.landingId,
    metadata: { form: "form1", via: "token" },
    req,
  });

  return Response.json({ success: true });
}
