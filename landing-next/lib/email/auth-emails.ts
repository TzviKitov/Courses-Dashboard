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
  const subject = "ההרשמה שלך אושרה — CourseFlow";
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

export async function sendInstructorInviteEmail(opts: {
  to: string;
  displayName?: string | null;
  setPasswordUrl: string;
}): Promise<SendEmailResult> {
  const name = opts.displayName?.trim() || "משתמש/ת";
  const subject = "הוזמנת למערכת CourseFlow";
  const html = `
    <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h1>שלום ${escapeHtml(name)},</h1>
      <p>נוצר עבורך חשבון מדריך. לחץ/י להגדרת סיסמה והשלמת ההרשמה:</p>
      <p><a href="${escapeHtml(opts.setPasswordUrl)}">הגדרת סיסמה</a></p>
    </div>
  `;
  const text = `שלום ${name},\nהגדרת סיסמה: ${opts.setPasswordUrl}`;
  return sendEmail({ to: opts.to, subject, html, text });
}

export async function sendPasswordResetEmail(opts: {
  to: string;
  setPasswordUrl: string;
}): Promise<SendEmailResult> {
  const subject = "איפוס סיסמה — CourseFlow";
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
