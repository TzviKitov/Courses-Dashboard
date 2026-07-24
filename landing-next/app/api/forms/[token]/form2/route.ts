import { getSupabaseAdmin } from "@/lib/supabase/server";
import { REGISTRATION_SELECT } from "@/lib/followups/access";
import {
  computeFollowupDueDates,
  isFormWindowOpen,
} from "@/lib/followups/dates";
import { requireFormToken } from "@/lib/followups/tokens";
import type { CompletionStatus } from "@/lib/supabase/types";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const auth = await requireFormToken(token, "form2");
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
  const [{ data: items }, { data: followup }] = await Promise.all([
    admin
      .from("registrations")
      .select(REGISTRATION_SELECT)
      .eq("landing_id", auth.landingId)
      .is("cancelled_at", null)
      .order("created_at", { ascending: true }),
    admin
      .from("landing_followups")
      .select("*")
      .eq("landing_id", auth.landingId)
      .maybeSingle(),
  ]);

  return Response.json({
    success: true,
    open: isFormWindowOpen(dues.form2),
    dueDate: dues.form2?.toISOString().slice(0, 10) ?? null,
    items: items ?? [],
    followup: followup ?? null,
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
  const auth = await requireFormToken(token, "form2");
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
    items?: {
      id: string;
      completion_status: CompletionStatus | null;
      form2_notes?: string | null;
    }[];
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const now = new Date().toISOString();
  await admin.from("landing_followups").upsert(
    {
      landing_id: auth.landingId,
      professionalism_rating: body.professionalism_rating ?? null,
      audience_fit_rating: body.audience_fit_rating ?? null,
      audience_fit_text:
        typeof body.audience_fit_text === "string" ? body.audience_fit_text : null,
      form2_notes: typeof body.form2_notes === "string" ? body.form2_notes : null,
      form2_submitted_at: now,
    },
    { onConflict: "landing_id" }
  );

  for (const item of body.items ?? []) {
    if (!item.id) continue;
    await admin
      .from("registrations")
      .update({
        completion_status: item.completion_status,
        form2_notes: typeof item.form2_notes === "string" ? item.form2_notes : null,
        form2_submitted_at: now,
      })
      .eq("id", item.id)
      .eq("landing_id", auth.landingId)
      .is("cancelled_at", null);
  }

  return Response.json({ success: true });
}
