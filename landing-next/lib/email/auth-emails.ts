import { SITE_DESCRIPTION, SITE_NAME } from "@/constants/site";
import { sendEmail, type SendEmailResult } from "@/lib/email/provider";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendInstructorApprovedEmail(opts: {
  to: string;
  displayName?: string | null;
  loginUrl: string;
  extraTo?: string | null;
}): Promise<SendEmailResult> {
  const name = opts.displayName?.trim() || "מדריך/ה";
  const subject = `ההרשמה שלך אושרה — ${SITE_NAME}`;
  const html = `
    <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h1>שלום ${escapeHtml(name)},</h1>
      <p>ההרשמה שלך כמדריך/ה אושרה. אפשר להתחיל ליצור קורסים.</p>
      <p><a href="${escapeHtml(opts.loginUrl)}">כניסה למערכת</a></p>
    </div>
  `;
  const text = `שלום ${name},\nההרשמה אושרה.\nכניסה: ${opts.loginUrl}`;

  const result = await sendEmail({ to: opts.to, subject, html, text });
  if (opts.extraTo?.trim()) {
    await sendEmail({
      to: opts.extraTo.trim(),
      subject: `עותק: אישור מדריך — ${name}`,
      html: `<div dir="rtl"><p>נשלח אישור הרשמה אל ${escapeHtml(opts.to)} עבור ${escapeHtml(name)}.</p></div>`,
      text: `אישור נשלח אל ${opts.to} עבור ${name}`,
    });
  }
  return result;
}

/**
 * Invitation to join as a guide. Written as a personal, contextual note (who invited,
 * what the system is, what happens next) rather than a bare "set your password"
 * link, which mail filters read as phishing when it comes from an unknown sender.
 */
export function buildInstructorInviteEmail(opts: {
  displayName?: string | null;
  inviterName?: string | null;
  joinUrl: string;
}): { subject: string; html: string; text: string } {
  const name = opts.displayName?.trim() || "";
  const inviter = opts.inviterName?.trim() || "";
  const greeting = name ? `היי ${name},` : "היי,";
  // No gender slashes ("הזמין/ה") and no brackets: they read like a template and
  // render badly in right-to-left clients.
  const subject = `הזמנה להצטרף לצוות המדריכים ב${SITE_NAME}`;
  const from = inviter ? `מ${inviter}` : "ממנהלי המערכת";
  const intro = `קיבלת הזמנה ${from} להצטרף לצוות המדריכים ב${SITE_NAME}.`;
  const about = `${SITE_NAME} היא מערכת ל${SITE_DESCRIPTION}.`;
  const how = "כדי להצטרף, פותחים את הקישור ובוחרים איך להיכנס:";
  const ignore = "אם לא ציפית להזמנה הזאת, אפשר פשוט להתעלם ממנה.";

  const html = `
    <div dir="rtl" lang="he" style="font-family: Arial, sans-serif; line-height: 1.7; color: #1a1a1a; text-align: right;">
      <p>${escapeHtml(greeting)}</p>
      <p>${escapeHtml(intro)} ${escapeHtml(about)}</p>
      <p>${escapeHtml(how)}</p>
      <p dir="ltr" style="text-align: right;"><a href="${escapeHtml(opts.joinUrl)}">${escapeHtml(opts.joinUrl)}</a></p>
      <p style="color:#555;font-size:13px;">${escapeHtml(ignore)}</p>
    </div>
  `;
  const text = [greeting, `${intro} ${about}`, how, opts.joinUrl, ignore].join("\n\n");
  return { subject, html, text };
}

export async function sendInstructorInviteEmail(opts: {
  to: string;
  displayName?: string | null;
  inviterName?: string | null;
  setPasswordUrl: string;
}): Promise<SendEmailResult> {
  const { subject, html, text } = buildInstructorInviteEmail({
    displayName: opts.displayName,
    inviterName: opts.inviterName,
    joinUrl: opts.setPasswordUrl,
  });
  return sendEmail({ to: opts.to, subject, html, text });
}

export async function sendPasswordResetEmail(opts: {
  to: string;
  setPasswordUrl: string;
}): Promise<SendEmailResult> {
  const subject = `איפוס סיסמה — ${SITE_NAME}`;
  const html = `
    <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h1>איפוס סיסמה</h1>
      <p>קיבלנו בקשה לאיפוס סיסמה. לחץ/י להגדרת סיסמה חדשה:</p>
      <p><a href="${escapeHtml(opts.setPasswordUrl)}">הגדרת סיסמה חדשה</a></p>
      <p style="font-size:12px;color:#666;">אם לא ביקשת איפוס — אפשר להתעלם מהמייל.</p>
    </div>
  `;
  const text = `איפוס סיסמה: ${opts.setPasswordUrl}`;
  return sendEmail({ to: opts.to, subject, html, text });
}
