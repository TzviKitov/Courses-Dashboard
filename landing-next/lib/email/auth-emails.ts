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
  const greeting = name ? `שלום ${name},` : "שלום,";
  const subject = inviter
    ? `${inviter} הזמין/ה אותך להצטרף כמדריך/ה ב${SITE_NAME}`
    : `הזמנה להצטרף כמדריך/ה ב${SITE_NAME}`;
  const who = inviter ? escapeHtml(inviter) : "מנהל/ת המערכת";
  const whoText = inviter || "מנהל/ת המערכת";

  const html = `
    <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.7; color: #1a1a1a;">
      <p>${escapeHtml(greeting)}</p>
      <p>${who} הוסיף/ה אותך כמדריך/ה ב${escapeHtml(SITE_NAME)}, מערכת ל${escapeHtml(SITE_DESCRIPTION)}.</p>
      <p>אפשר להצטרף דרך הקישור, ושם תגדיר את אופן הכניסה שלך:</p>
      <p><a href="${escapeHtml(opts.joinUrl)}">${escapeHtml(opts.joinUrl)}</a></p>
      <p style="color:#555;font-size:13px;">
        אם ההזמנה הזו לא מוכרת לך, אפשר להתעלם ממנה. לא יקרה כלום.
      </p>
    </div>
  `;
  const text = [
    greeting,
    `${whoText} הוסיף/ה אותך כמדריך/ה ב${SITE_NAME}, מערכת ל${SITE_DESCRIPTION}.`,
    "אפשר להצטרף בקישור:",
    opts.joinUrl,
    "אם ההזמנה לא מוכרת לך, אפשר להתעלם ממנה.",
  ].join("\n\n");
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
