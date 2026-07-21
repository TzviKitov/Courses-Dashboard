import { canManageLanding } from "@/lib/auth/admin";
import { getSupabaseAdmin, isSupabaseDbEnabled } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/ssr";
import type { RegistrationRow } from "@/lib/supabase/types";

/**
 * GET /api/landings/[id]/registrations
 *
 * Owner-only. Returns the registrations for a course.
 *
 * Query params:
 *   format=csv  - download as CSV instead of JSON.
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

  const admin = getSupabaseAdmin();
  const { data: landing, error: landingError } = await admin
    .from("landings")
    .select("owner_id")
    .eq("id", id)
    .maybeSingle();

  if (landingError || !landing) {
    return Response.json({ success: false, error: "Not found" }, { status: 404 });
  }
  if (!canManageLanding(user, landing.owner_id)) {
    return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await admin
    .from("registrations")
    .select("id, landing_id, full_name, phone, email, referral, notes, created_at")
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
      },
    });
  }

  return Response.json({ success: true, items: rows });
}

function toCsv(rows: RegistrationRow[]): string {
  const header = ["created_at", "full_name", "phone", "email", "referral", "notes"];
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
      ].join(",")
    );
  }
  // BOM for Excel to detect UTF-8.
  return "\uFEFF" + lines.join("\n");
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
