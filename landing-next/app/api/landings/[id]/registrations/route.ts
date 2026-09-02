import { getCurrentUser, getSupabaseServer } from "@/lib/supabase/ssr";
import { getSupabaseAdmin, isSupabaseDbEnabled } from "@/lib/supabase/server";
import type { RegistrationRow } from "@/lib/supabase/types";
import { requireLandingAccess } from "@/lib/followups/access";
import {
  computeFollowupDueDates,
  isFormWindowOpen,
} from "@/lib/followups/dates";
import { getProfile } from "@/lib/auth/profiles";
import { logAuditEvent } from "@/lib/security/audit";
import {
  REGISTRATION_SELECT_SAFE,
  REGISTRATION_SELECT_WITH_NOTES,
  clampNotes,
  csvHeaders,
  profileCanExportRegistrants,
  profileCanExportSensitiveNotes,
  viewerCanSeeSensitiveNotes,
} from "@/lib/security/sensitive-notes";

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
  const includeNotes = url.searchParams.get("include") === "notes";
  const includeCsvNotes = url.searchParams.get("notes") === "1";

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

  const profile = await getProfile(user.id);
  const canNotes = await viewerCanSeeSensitiveNotes(
    user,
    id,
    access.landing.owner_id
  );
  const wantNotes = (includeNotes || (format === "csv" && includeCsvNotes)) && canNotes;

  const select = wantNotes ? REGISTRATION_SELECT_WITH_NOTES : REGISTRATION_SELECT_SAFE;

  let data: RegistrationRow[] | null = null;
  let errorMessage: string | null = null;
  try {
    const scoped = await getSupabaseServer();
    const result = await scoped
      .from("registrations")
      .select(select)
      .eq("landing_id", id)
      .order("created_at", { ascending: false });
    if (result.error) {
      errorMessage = result.error.message;
    } else {
      data = (result.data ?? []) as unknown as RegistrationRow[];
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "query failed";
  }

  if (errorMessage || !data) {
    const admin = getSupabaseAdmin();
    const fallback = await admin
      .from("registrations")
      .select(select)
      .eq("landing_id", id)
      .order("created_at", { ascending: false });
    if (fallback.error) {
      return Response.json(
        { success: false, error: fallback.error.message },
        { status: 500 }
      );
    }
    data = (fallback.data ?? []) as unknown as RegistrationRow[];
  }

  const rows = data ?? [];

  if (format === "csv") {
    if (!profileCanExportRegistrants(profile)) {
      logAuditEvent({
        actorId: user.id,
        action: "export_csv",
        resourceType: "landing",
        resourceId: id,
        result: "denied",
        req,
      });
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    const withNotes = includeCsvNotes && profileCanExportSensitiveNotes(profile);
    logAuditEvent({
      actorId: user.id,
      action: "export_csv",
      resourceType: "landing",
      resourceId: id,
      metadata: { includeNotes: withNotes, count: rows.length },
      req,
    });
    const csv = toCsv(rows, withNotes);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="registrations-${id}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  logAuditEvent({
    actorId: user.id,
    action: wantNotes ? "view_notes" : "view_registrants",
    resourceType: "landing",
    resourceId: id,
    metadata: { count: rows.length },
    req,
  });

  const dues = computeFollowupDueDates(
    access.landing.start_date,
    access.landing.end_date
  );
  const windows = {
    form1: isFormWindowOpen(dues.form1),
    form2: isFormWindowOpen(dues.form2),
    form3: isFormWindowOpen(dues.form3),
  };

  const admin = getSupabaseAdmin();
  const { data: attachments } = await admin
    .from("registration_attachments")
    .select(
      "id, registration_id, landing_id, file_name, mime_type, size_bytes, created_at, created_by"
    )
    .eq("landing_id", id);

  return Response.json({
    success: true,
    items: rows,
    attachments: attachments ?? [],
    canViewNotes: canNotes,
    canExportNotes: profileCanExportSensitiveNotes(profile),
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

  const notesSelect = (await viewerCanSeeSensitiveNotes(
    user,
    id,
    access.landing.owner_id
  ))
    ? REGISTRATION_SELECT_WITH_NOTES
    : REGISTRATION_SELECT_SAFE;

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
        instructor_notes: clampNotes(reason),
      })
      .eq("id", body.id)
      .eq("landing_id", id)
      .select(notesSelect)
      .single();

    if (error) {
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }
    logAuditEvent({
      actorId: user.id,
      action: "update_notes",
      resourceType: "registration",
      resourceId: body.id,
      metadata: { cancel: true, landingId: id },
      req,
    });
    return Response.json({ success: true, item: data });
  }

  if (body.instructor_notes !== undefined) {
    if (!(await viewerCanSeeSensitiveNotes(user, id, access.landing.owner_id))) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    if (existing.cancelled_at) {
      return Response.json(
        { success: false, error: "Cannot edit cancelled registration notes this way" },
        { status: 400 }
      );
    }
    const notes = clampNotes(body.instructor_notes);
    const { data, error } = await admin
      .from("registrations")
      .update({ instructor_notes: notes })
      .eq("id", body.id)
      .eq("landing_id", id)
      .select(REGISTRATION_SELECT_WITH_NOTES)
      .single();

    if (error) {
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }
    logAuditEvent({
      actorId: user.id,
      action: "update_notes",
      resourceType: "registration",
      resourceId: body.id,
      metadata: { landingId: id },
      req,
    });
    return Response.json({ success: true, item: data });
  }

  return Response.json({ success: false, error: "Nothing to update" }, { status: 400 });
}

function toCsv(rows: RegistrationRow[], includeNotes: boolean): string {
  const header = csvHeaders(includeNotes);
  const lines = [header.join(",")];
  for (const row of rows) {
    const values: string[] = [
      row.created_at,
      csvEscape(row.full_name),
      csvEscape(row.phone),
      csvEscape(row.email ?? ""),
      csvEscape(row.referral ?? ""),
      csvEscape(row.notes ?? ""),
      csvEscape(row.cancelled_at ?? ""),
      csvEscape(row.cancellation_reason ?? ""),
      csvEscape(row.acceptance_status ?? ""),
      csvEscape(row.completion_status ?? ""),
      row.placement_status === null || row.placement_status === undefined
        ? ""
        : row.placement_status
          ? "yes"
          : "no",
      csvEscape(row.placement_where ?? ""),
      row.birth_year != null ? String(row.birth_year) : "",
      row.marketing_opt_in ? "yes" : "no",
    ];
    if (includeNotes) {
      values.push(
        csvEscape(row.instructor_notes ?? ""),
        csvEscape(row.form1_notes ?? ""),
        csvEscape(row.form2_notes ?? ""),
        csvEscape(row.form3_feedback ?? ""),
        csvEscape(row.form3_notes ?? "")
      );
    }
    lines.push(values.join(","));
  }
  return "\uFEFF" + lines.join("\n");
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
