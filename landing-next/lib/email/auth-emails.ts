import { sendEmail } from "@/lib/email/provider";

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
}): Promise<void> {
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

  await sendEmail({ to: opts.to, subject, html, text });
  if (opts.extraTo?.trim()) {
    await sendEmail({
      to: opts.extraTo.trim(),
      subject: `עותק: אישור מדריך — ${name}`,
      html: `<div dir="rtl"><p>נשלח אישור הרשמה אל ${escapeHtml(opts.to)} עבור ${escapeHtml(name)}.</p></div>`,
      text: `אישור נשלח אל ${opts.to} עבור ${name}`,
    });
  }
}

export async function sendInstructorInviteEmail(opts: {
  to: string;
  displayName?: string | null;
  setPasswordUrl: string;
}): Promise<void> {
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
  await sendEmail({ to: opts.to, subject, html, text });
}
