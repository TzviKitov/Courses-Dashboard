import { SITE_NAME } from "@/constants/site";
import { extractEmailAddress, sendEmail } from "@/lib/email/provider";
import { getSupabaseAdmin } from "@/lib/supabase/server";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Who gets "new instructor request" mails: env first, then every admin account. */
async function adminRecipients(): Promise<string[]> {
  const fromEnv = [process.env.ADMIN_NOTIFY_EMAIL, process.env.SECURITY_ALERT_EMAIL]
    .flatMap((v) => (v || "").split(","))
    .map((v) => extractEmailAddress(v.trim()))
    .filter((v): v is string => Boolean(v));
  if (fromEnv.length) return [...new Set(fromEnv)];

  try {
    const admin = getSupabaseAdmin();
    const { data: admins } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "admin")
      .eq("status", "active");
    const emails: string[] = [];
    for (const row of admins ?? []) {
      const { data } = await admin.auth.admin.getUserById(
        (row as { id: string }).id
      );
      const e = extractEmailAddress(data.user?.email);
      if (e) emails.push(e);
    }
    return [...new Set(emails)];
  } catch (e) {
    console.error("[admin-notify] recipients lookup failed:", e);
    return [];
  }
}

/**
 * Tells admins a new instructor is waiting for approval.
 * Never throws: signup must not fail because a notification mail failed.
 */
export async function notifyAdminsOfInstructorRequest(opts: {
  email?: string | null;
  displayName?: string | null;
  phone?: string | null;
  via: "email" | "azure" | "google";
}): Promise<void> {
  try {
    const to = await adminRecipients();
    if (!to.length) {
      console.warn("[admin-notify] no admin recipients, request mail not sent");
      return;
    }
    const base = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/$/, "");
    const link = `${base}/dashboard/admin/users`;
    const name = opts.displayName?.trim() || "ללא שם";
    const via =
      opts.via === "azure" ? "Microsoft" : opts.via === "google" ? "Google" : "מייל וסיסמה";
    const subject = `בקשת הרשמת מדריך חדשה — ${name}`;
    const html = `
      <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h1>בקשת מדריך חדשה ב${escapeHtml(SITE_NAME)}</h1>
        <p><strong>שם:</strong> ${escapeHtml(name)}</p>
        <p><strong>מייל:</strong> <span dir="ltr">${escapeHtml(opts.email || "לא ידוע")}</span></p>
        ${opts.phone ? `<p><strong>נייד:</strong> <span dir="ltr">${escapeHtml(opts.phone)}</span></p>` : ""}
        <p><strong>נרשם דרך:</strong> ${escapeHtml(via)}</p>
        <p><a href="${escapeHtml(link)}">לאישור או דחייה בניהול משתמשים</a></p>
      </div>
    `;
    const text = `בקשת מדריך חדשה: ${name} (${opts.email || "?"}) דרך ${via}\n${link}`;
    for (const addr of to) {
      await sendEmail({ to: addr, subject, html, text });
    }
  } catch (e) {
    console.error("[admin-notify] failed:", e);
  }
}
