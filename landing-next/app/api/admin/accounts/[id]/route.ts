import { requireAdminApi } from "@/lib/admin/require-admin";
import { sendInstructorApprovedEmail } from "@/lib/email/auth-emails";
import { getProfile, updateProfile } from "@/lib/auth/profiles";
import { getAuthOrigin } from "@/lib/supabase/ssr";
import { getSupabaseAdmin } from "@/lib/supabase/server";

type Action =
  | "approve"
  | "disable"
  | "enable"
  | "make_admin"
  | "make_instructor"
  | "grant_learners_access"
  | "deny_learners_access"
  | "delete";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  let body: { action?: Action; extraEmail?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const action = body.action;
  if (!action) {
    return Response.json({ success: false, error: "action required" }, { status: 400 });
  }

  const profile = await getProfile(id);
  if (!profile) {
    return Response.json({ success: false, error: "Not found" }, { status: 404 });
  }

  const admin = getSupabaseAdmin();
  const origin = getAuthOrigin(req);

  if (action === "approve") {
    await updateProfile(id, { status: "active", role: "instructor" });
    const { data } = await admin.auth.admin.getUserById(id);
    const email = data.user?.email;
    if (email) {
      await sendInstructorApprovedEmail({
        to: email,
        displayName: profile.display_name,
        loginUrl: `${origin}/auth/login`,
        extraTo: body.extraEmail,
      });
    }
    return Response.json({ success: true });
  }

  if (action === "disable") {
    await updateProfile(id, { status: "disabled" });
    return Response.json({ success: true });
  }

  if (action === "enable") {
    await updateProfile(id, { status: "active" });
    return Response.json({ success: true });
  }

  if (action === "make_admin") {
    await updateProfile(id, { role: "admin", status: "active" });
    return Response.json({ success: true });
  }

  if (action === "make_instructor") {
    await updateProfile(id, { role: "instructor", status: "active" });
    return Response.json({ success: true });
  }

  if (action === "grant_learners_access") {
    await updateProfile(id, {
      can_view_all_learners: true,
      requested_all_learners_at: null,
    });
    return Response.json({ success: true });
  }

  if (action === "deny_learners_access") {
    await updateProfile(id, {
      can_view_all_learners: false,
      requested_all_learners_at: null,
    });
    return Response.json({ success: true });
  }

  if (action === "delete") {
    // Transfer landings to acting admin
    await admin
      .from("landings")
      .update({ owner_id: gate.user.id })
      .eq("owner_id", id);

    await admin.from("landing_instructors").delete().eq("user_id", id);

    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) {
      return Response.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }
    // profiles cascades from auth.users
    return Response.json({ success: true });
  }

  return Response.json({ success: false, error: "Unknown action" }, { status: 400 });
}
