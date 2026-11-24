import { validatePassword } from "@/lib/auth/password";
import { ensureProfile, syncAuthAppMetadata } from "@/lib/auth/profiles";
import { sendInstructorInviteEmail } from "@/lib/email/auth-emails";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/security/audit";

export type InviteResult =
  | { ok: true; userId: string; warning?: string; inviteLink?: string }
  | { ok: false; error: string };

/**
 * Create an instructor account and email an invite link to set a password.
 * Admin-only: callers must have checked that already.
 */
export async function inviteInstructor(opts: {
  email: string;
  displayName: string;
  role?: "instructor" | "admin";
  phone?: string | null;
  origin: string;
  actorId: string;
  req?: Request;
}): Promise<InviteResult> {
  const role = opts.role ?? "instructor";
  const admin = getSupabaseAdmin();

  // Temporary password: the user must reset it via the invite link.
  const tempPassword = `Tmp!${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}Aa1`;
  if (!validatePassword(tempPassword).ok) {
    // should always pass
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: opts.email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      full_name: opts.displayName,
      display_name: opts.displayName,
    },
    app_metadata: { role, status: "active" },
  });
  if (error || !data.user) {
    return { ok: false, error: error?.message || "Create user failed" };
  }

  await ensureProfile({
    userId: data.user.id,
    displayName: opts.displayName,
    role,
    status: "active",
    createdVia: "admin_invite",
    phone: opts.phone ?? null,
  });
  await syncAuthAppMetadata(data.user.id, role, "active");

  logAuditEvent({
    actorId: opts.actorId,
    action: "role_change",
    resourceType: "profile",
    resourceId: data.user.id,
    metadata: { action: "invite", role },
    req: opts.req,
  });

  const { data: linkData, error: linkErr } =
    await admin.auth.admin.generateLink({
      type: "recovery",
      email: opts.email,
      options: { redirectTo: `${opts.origin}/auth/set-password` },
    });
  if (linkErr || !linkData) {
    console.error("generateLink failed:", linkErr);
    return {
      ok: true,
      userId: data.user.id,
      warning: "User created but invite email link failed",
    };
  }

  const actionLink =
    linkData.properties?.action_link ||
    (linkData as { action_link?: string }).action_link ||
    `${opts.origin}/auth/login`;

  const sent = await sendInstructorInviteEmail({
    to: opts.email,
    displayName: opts.displayName,
    setPasswordUrl: actionLink,
  });
  if (!sent.ok || sent.skipped) {
    return {
      ok: true,
      userId: data.user.id,
      inviteLink: actionLink,
      warning: sent.skipped
        ? "המשתמש נוצר אך המייל לא נשלח (חסר RESEND_API_KEY)"
        : `המשתמש נוצר אך שליחת מייל ההזמנה נכשלה: ${sent.error ?? "send failed"}`,
    };
  }
  return { ok: true, userId: data.user.id, inviteLink: actionLink };
}
