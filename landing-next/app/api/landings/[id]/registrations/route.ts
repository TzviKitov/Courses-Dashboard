import { getCurrentUser } from "@/lib/supabase/ssr";
import { getSupabaseAdmin, isSupabaseDbEnabled } from "@/lib/supabase/server";
import type { RegistrationRow } from "@/lib/supabase/types";
import {
  REGISTRATION_SELECT,
  requireLandingAccess,
} from "@/lib/followups/access";
import {
  computeFollowupDueDates,
  isFormWindowOpen,
} from "@/lib/followups/dates";

/**
 * GET /api/landings/[id]/registrations
 * PATCH /api/landings/[id]/registrations  { id, instructor_notes? } | { id, cancel: true, cancellation_reason }
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(req.url);
  const format = url.searchParams.get("format");

  if (!isSupabaseDbEnabled()) {
    return Response.json(
      { success: false, error: "Registrations require Supabase to be enabled." },
      { status: 503 }
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const access = await requireLandingAccess(user, id);
  if ("error" in access) return access.error;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("registrations")
    .select(REGISTRATION_SELECT)
    .eq("landing_id", id)
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as RegistrationRow[];

  if (format === "csv") {
    const csv = toCsv(rows);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="registrations-${id}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  const dues = computeFollowupDueDates(
    access.landing.start_date,
    access.landing.end_date
  );
  const windows = {
    form1: isFormWindowOpen(dues.form1),
    form2: isFormWindowOpen(dues.form2),
    form3: isFormWindowOpen(dues.form3),
  };

  const { data: attachments } = await admin
    .from("registration_attachments")
    .select(
      "id, registration_id, landing_id, file_name, storage_path, mime_type, size_bytes, created_at, created_by"
    )
    .eq("landing_id", id);

  return Response.json({
    success: true,
    items: rows,
    attachments: attachments ?? [],
    windows,
    dueDates: {
      form1: dues.form1?.toISOString().slice(0, 10) ?? null,
      form2: dues.form2?.toISOString().slice(0, 10) ?? null,
      form3: dues.form3?.toISOString().slice(0, 10) ?? null,
    },
    landing: {
      id: access.landing.id,
      title: access.landing.course?.title ?? "",
      start_date: access.landing.start_date,
      end_date: access.landing.end_date,
      bannerThumbUrl: access.landing.assets?.bannerThumbUrl,
      bannerFullUrl: access.landing.assets?.bannerFullUrl,
    },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!isSupabaseDbEnabled()) {
    return Response.json(
      { success: false, error: "Registrations require Supabase to be enabled." },
      { status: 503 }
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const access = await requireLandingAccess(user, id);
  if ("error" in access) return access.error;

  let body: {
    id?: string;
    instructor_notes?: string | null;
    cancel?: boolean;
    cancellation_reason?: string;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.id || typeof body.id !== "string") {
    return Response.json({ success: false, error: "id required" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: existing, error: findError } = await admin
    .from("registrations")
    .select("id, cancelled_at")
    .eq("id", body.id)
    .eq("landing_id", id)
    .maybeSingle();

  if (findError || !existing) {
    return Response.json({ success: false, error: "Not found" }, { status: 404 });
  }

  if (body.cancel) {
    const reason =
      typeof body.cancellation_reason === "string"
        ? body.cancellation_reason.trim()
        : "";
    if (!reason) {
      return Response.json(
        { success: false, error: "cancellation_reason is required" },
        { status: 400 }
      );
    }
    const { data, error } = await admin
      .from("registrations")
      .update({
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason,
        instructor_notes: reason,
      })
      .eq("id", body.id)
      .eq("landing_id", id)
      .select(REGISTRATION_SELECT)
      .single();

    if (error) {
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }
    return Response.json({ success: true, item: data });
  }

  if (body.instructor_notes !== undefined) {
    if (existing.cancelled_at) {
      return Response.json(
        { success: false, error: "Cannot edit cancelled registration notes this way" },
        { status: 400 }
      );
    }
    const notes =
      typeof body.instructor_notes === "string" ? body.instructor_notes : null;
    const { data, error } = await admin
      .from("registrations")
      .update({ instructor_notes: notes })
      .eq("id", body.id)
      .eq("landing_id", id)
      .select(REGISTRATION_SELECT)
      .single();

    if (error) {
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }
    return Response.json({ success: true, item: data });
  }

  return Response.json({ success: false, error: "Nothing to update" }, { status: 400 });
}

function toCsv(rows: RegistrationRow[]): string {
  const header = [
    "created_at",
    "full_name",
    "phone",
    "email",
    "referral",
    "notes",
    "instructor_notes",
    "cancelled_at",
    "cancellation_reason",
    "acceptance_status",
    "form1_notes",
    "completion_status",
    "form2_notes",
    "placement_status",
    "placement_where",
    "form3_feedback",
    "form3_notes",
  ];
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.created_at,
        csvEscape(row.full_name),
        csvEscape(row.phone),
        csvEscape(row.email ?? ""),
        csvEscape(row.referral ?? ""),
        csvEscape(row.notes ?? ""),
        csvEscape(row.instructor_notes ?? ""),
        csvEscape(row.cancelled_at ?? ""),
        csvEscape(row.cancellation_reason ?? ""),
        csvEscape(row.acceptance_status ?? ""),
        csvEscape(row.form1_notes ?? ""),
        csvEscape(row.completion_status ?? ""),
        csvEscape(row.form2_notes ?? ""),
        row.placement_status === null || row.placement_status === undefined
          ? ""
          : row.placement_status
            ? "yes"
            : "no",
        csvEscape(row.placement_where ?? ""),
        csvEscape(row.form3_feedback ?? ""),
        csvEscape(row.form3_notes ?? ""),
      ].join(",")
    );
  }
  return "\uFEFF" + lines.join("\n");
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
