import { Resend } from "resend";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  idempotencyKey?: string;
}

export interface SendEmailResult {
  ok: boolean;
  id?: string;
  error?: string;
  skipped?: boolean;
}

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const FALLBACK_FROM = "CourseFlow <onboarding@resend.dev>";

function encodeRfc2047(displayName: string): string {
  return `=?UTF-8?B?${Buffer.from(displayName, "utf8").toString("base64")}?=`;
}

/**
 * Resend rejects quoted-wrapped env values and some raw UTF-8 display names.
 * Keep a parseable `email` or `Name <email>` / encoded-name form.
 */
export function normalizeEmailFrom(raw: string | undefined | null): string {
  if (!raw) return FALLBACK_FROM;
  let s = raw.replace(/^\uFEFF/, "").trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  const angled = s.match(/^(.*)<([^<>]+)>$/);
  if (angled) {
    const name = angled[1].trim().replace(/^["']|["']$/g, "");
    const email = angled[2].trim();
    if (!EMAIL_RE.test(email)) return FALLBACK_FROM;
    if (!name) return email;
    if (/^[\x20-\x7E]+$/.test(name) && !/[<>,"]/.test(name)) {
      return `${name} <${email}>`;
    }
    return `${encodeRfc2047(name)} <${email}>`;
  }
  if (EMAIL_RE.test(s)) return s;
  return FALLBACK_FROM;
}

export function extractEmailAddress(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const normalized = normalizeEmailFrom(raw);
  const angled = normalized.match(/<([^<>]+)>/);
  const email = (angled ? angled[1] : normalized).trim().toLowerCase();
  return EMAIL_RE.test(email) ? email : null;
}

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export function getEmailFrom(): string {
  return normalizeEmailFrom(process.env.EMAIL_FROM);
}

function resendErrorMessage(error: unknown): string {
  if (!error) return "send failed";
  if (typeof error === "string") return error;
  if (typeof error === "object") {
    const e = error as { message?: string; name?: string };
    return e.message || e.name || "send failed";
  }
  return "send failed";
}

/**
 * Send via Resend. If RESEND_API_KEY missing, logs and returns skipped.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const resend = getResend();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY missing — skip send to", input.to);
    return { ok: true, skipped: true };
  }

  const { data, error } = await resend.emails.send(
    {
      from: getEmailFrom(),
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    },
    input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}
  );

  if (error) {
    console.error("[email] send failed:", error);
    return { ok: false, error: resendErrorMessage(error) };
  }

  return { ok: true, id: data?.id };
}

export function buildCourseOpenEmail(opts: {
  courseTitle: string;
  landingUrl: string;
  registrantsUrl: string;
  bannerUrl?: string | null;
}): { subject: string; html: string; text: string } {
  const subject = `פתיחת קורס: ${opts.courseTitle}`;
  const html = `
    <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.5;">
      <h1>${escapeHtml(opts.courseTitle)}</h1>
      <p>הקורס נפתח. להלן הקישורים:</p>
      ${
        opts.bannerUrl
          ? `<p><img src="${escapeHtml(opts.bannerUrl)}" alt="" style="max-width:100%;border-radius:8px;" /></p>`
          : ""
      }
      <p><a href="${escapeHtml(opts.landingUrl)}">דף הנחיתה</a></p>
      <p><a href="${escapeHtml(opts.registrantsUrl)}">רשימת נרשמים (צפייה וייצוא)</a></p>
    </div>
  `;
  const text = `${opts.courseTitle}\nדף נחיתה: ${opts.landingUrl}\nנרשמים: ${opts.registrantsUrl}`;
  return { subject, html, text };
}

export function buildFormEmail(opts: {
  formLabel: string;
  courseTitle: string;
  formUrl: string;
  isReminder?: boolean;
  recipientEmail?: string;
}): { subject: string; html: string; text: string } {
  const prefix = opts.isReminder ? "תזכורת: " : "";
  const subject = `${prefix}${opts.formLabel} — ${opts.courseTitle}`;
  const html = `
    <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.5;">
      <h1>${escapeHtml(opts.formLabel)}</h1>
      <p>קורס: <strong>${escapeHtml(opts.courseTitle)}</strong></p>
      <p>${opts.isReminder ? "טרם מולא הטופס. " : ""}לחצו למילוי:</p>
      <p><a href="${escapeHtml(opts.formUrl)}" style="display:inline-block;padding:10px 16px;background:#0d9488;color:#fff;border-radius:6px;text-decoration:none;">מילוי הטופס</a></p>
      <p style="font-size:12px;color:#666;">או העתיקו: ${escapeHtml(opts.formUrl)}</p>
      <p style="font-size:11px;color:#888;margin-top:24px;">
        להסרה מדיוור שיווקי: ${escapeHtml(unsubscribeUrl(opts.recipientEmail))}
      </p>
    </div>
  `;
  const text = `${subject}\n${opts.formUrl}`;
  return { subject, html, text };
}

function unsubscribeUrl(email?: string | null): string {
  const base = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/$/, "");
  const url = `${base}/api/unsubscribe`;
  if (!email) return url;
  return `${url}?email=${encodeURIComponent(email)}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
