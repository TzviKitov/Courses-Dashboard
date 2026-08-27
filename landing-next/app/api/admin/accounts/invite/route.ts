import { requireAdminApi } from "@/lib/admin/require-admin";
import { sendInstructorInviteEmail } from "@/lib/email/auth-emails";
import { validatePassword } from "@/lib/auth/password";
import {
  ensureProfile,
  syncAuthAppMetadata,
} from "@/lib/auth/profiles";
import { getAuthOrigin } from "@/lib/supabase/ssr";
import { getSupabaseAdmin } from "@/lib/supabase/server";

/** Admin invites a new instructor (email + magic link to set password). */
export async function POST(req: Request) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  let body: {
    email?: string;
    displayName?: string;
    role?: "instructor" | "admin";
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return Response.json({ success: false, error: "Email required" }, { status: 400 });
  }

  const role = body.role === "admin" ? "admin" : "instructor";
  const displayName = body.displayName?.trim() || email.split("@")[0];
  const admin = getSupabaseAdmin();
  const origin = getAuthOrigin(req);

  // Temporary password — user must reset via invite link
  const tempPassword = `Tmp!${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}Aa1`;
  if (!validatePassword(tempPassword).ok) {
    // should always pass
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: displayName, display_name: displayName },
    app_metadata: { role, status: "active" },
  });

  if (error || !data.user) {
    return Response.json(
      { success: false, error: error?.message || "Create user failed" },
      { status: 400 }
    );
  }

  await ensureProfile({
    userId: data.user.id,
    displayName,
    role,
    status: "active",
    createdVia: "admin_invite",
  });
  await syncAuthAppMetadata(data.user.id, role, "active");

  const { data: linkData, error: linkErr } =
    await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: `${origin}/auth/set-password`,
      },
    });

  if (linkErr || !linkData) {
    console.error("generateLink failed:", linkErr);
    return Response.json({
      success: true,
      userId: data.user.id,
      warning: "User created but invite email link failed",
    });
  }

  const actionLink =
    linkData.properties?.action_link ||
    (linkData as { action_link?: string }).action_link ||
    `${origin}/auth/login`;

  await sendInstructorInviteEmail({
    to: email,
    displayName,
    setPasswordUrl: actionLink,
  });

  return Response.json({ success: true, userId: data.user.id });
}
