import { requireAdminApi } from "@/lib/admin/require-admin";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function GET() {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("instructor_email_allowlist")
    .select("email, note, created_by, created_at")
    .order("email");

  if (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
  return Response.json({ success: true, items: data ?? [] });
}

export async function POST(req: Request) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  let body: { email?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return Response.json({ success: false, error: "Invalid email" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("instructor_email_allowlist").upsert({
    email,
    note: body.note?.trim() || null,
    created_by: gate.user.id,
  });

  if (error) {
    return Response.json({ success: false, error: error.message }, { status: 400 });
  }
  return Response.json({ success: true });
}

export async function DELETE(req: Request) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const email = url.searchParams.get("email")?.trim().toLowerCase();
  if (!email) {
    return Response.json({ success: false, error: "email required" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("instructor_email_allowlist")
    .delete()
    .eq("email", email);

  if (error) {
    return Response.json({ success: false, error: error.message }, { status: 400 });
  }
  return Response.json({ success: true });
}
