import { getSupabaseAdmin } from "@/lib/supabase/server";
import { resolveOwnerEmails } from "@/lib/admin/owner-emails";
import {
  addDays,
  computeFollowupDueDates,
  toIsoDate,
} from "@/lib/followups/dates";
import { issueFormToken } from "@/lib/followups/tokens";
import {
  buildCourseOpenEmail,
  buildFormEmail,
  sendEmail,
} from "@/lib/email/provider";
import { getServerBaseUrlFromEnv } from "@/lib/server-base-url";
import type {
  EmailOutboxType,
  FormAccessType,
  LandingRow,
} from "@/lib/supabase/types";

const FORM_LABELS: Record<"form1" | "form2" | "form3", string> = {
  form1: "טופס 1 — קבלה לנרשמים",
  form2: "טופס 2 — סיום קורס",
  form3: "טופס 3 — השמה",
};

type PrimaryType = "course_open" | "form1" | "form2" | "form3";

function reminderType(primary: PrimaryType): EmailOutboxType {
  return `reminder_${primary}` as EmailOutboxType;
}

function contactEmailFromLanding(landing: LandingRow): string | null {
  const email = landing.course?.contactEmail;
  if (typeof email === "string" && email.includes("@")) {
    return email.trim().toLowerCase();
  }
  return null;
}

async function recipientsForLanding(
  landing: LandingRow
): Promise<string[]> {
  const set = new Set<string>();
  if (landing.owner_id) {
    const map = await resolveOwnerEmails([landing.owner_id]);
    const ownerEmail = map.get(landing.owner_id);
    if (ownerEmail && ownerEmail !== "—" && ownerEmail.includes("@")) {
      set.add(ownerEmail.toLowerCase());
    }
  }
  const contact = contactEmailFromLanding(landing);
  if (contact) set.add(contact);
  return [...set];
}

function baseUrl(): string {
  return getServerBaseUrlFromEnv() || "http://localhost:3000";
}

function isFormSubmitted(
  primary: PrimaryType,
  landingId: string,
  followup: {
    form2_submitted_at: string | null;
    form3_submitted_at: string | null;
  } | null,
  anyForm1: boolean
): boolean {
  if (primary === "course_open") return false;
  if (primary === "form1") return anyForm1;
  if (primary === "form2") return Boolean(followup?.form2_submitted_at);
  if (primary === "form3") return Boolean(followup?.form3_submitted_at);
  return false;
}

/**
 * Daily cron: enqueue due emails + send pending outbox rows.
 */
export async function runFollowupCron(now: Date = new Date()): Promise<{
  enqueued: number;
  sent: number;
  failed: number;
}> {
  const admin = getSupabaseAdmin();
  const today = toIsoDate(now);

  const { data: landings, error } = await admin
    .from("landings")
    .select("*")
    .not("start_date", "is", null);

  if (error) throw new Error(error.message);

  let enqueued = 0;

  for (const raw of landings ?? []) {
    const landing = raw as LandingRow;
    const dues = computeFollowupDueDates(landing.start_date, landing.end_date);
    const recipients = await recipientsForLanding(landing);
    if (recipients.length === 0) continue;

    const scheduleIfDue = async (
      primary: PrimaryType,
      due: Date | null
    ) => {
      if (!due) return;
      if (toIsoDate(due) > today) return;

      for (const recipient of recipients) {
        const { error: insertError } = await admin.from("email_outbox").insert({
          landing_id: landing.id,
          email_type: primary,
          recipient,
          scheduled_for: due.toISOString(),
          status: "pending",
        });
        // unique violation = already enqueued
        if (!insertError) enqueued += 1;
      }
    };

    await scheduleIfDue("course_open", dues.courseOpen);
    await scheduleIfDue("form1", dues.form1);
    await scheduleIfDue("form2", dues.form2);
    await scheduleIfDue("form3", dues.form3);
  }

  // Reminders: for sent primary emails older than 7 days, if form not submitted
  const { data: sentPrimaries } = await admin
    .from("email_outbox")
    .select("*")
    .in("email_type", ["course_open", "form1", "form2", "form3"])
    .eq("status", "sent")
    .is("reminder_of", null);

  for (const row of sentPrimaries ?? []) {
    if (!row.sent_at) continue;
    const reminderAt = addDays(new Date(row.sent_at), 7);
    if (toIsoDate(reminderAt) > today) continue;

    const primary = row.email_type as PrimaryType;
    if (primary === "course_open") continue; // no "submit" for open pack

    const { data: followup } = await admin
      .from("landing_followups")
      .select("form2_submitted_at, form3_submitted_at")
      .eq("landing_id", row.landing_id)
      .maybeSingle();

    let anyForm1 = false;
    if (primary === "form1") {
      const { count } = await admin
        .from("registrations")
        .select("id", { count: "exact", head: true })
        .eq("landing_id", row.landing_id)
        .not("form1_submitted_at", "is", null);
      anyForm1 = (count ?? 0) > 0;
    }

    if (isFormSubmitted(primary, row.landing_id, followup, anyForm1)) {
      continue;
    }

    const rType = reminderType(primary);
    const { error: remError } = await admin.from("email_outbox").insert({
      landing_id: row.landing_id,
      email_type: rType,
      recipient: row.recipient,
      scheduled_for: reminderAt.toISOString(),
      reminder_of: row.id,
      status: "pending",
    });
    if (!remError) enqueued += 1;
  }

  // Send pending due now
  const { data: pending } = await admin
    .from("email_outbox")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", now.toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(100);

  let sent = 0;
  let failed = 0;
  const origin = baseUrl();

  for (const job of pending ?? []) {
    const { data: landingRaw } = await admin
      .from("landings")
      .select("*")
      .eq("id", job.landing_id)
      .maybeSingle();

    if (!landingRaw) {
      await admin
        .from("email_outbox")
        .update({ status: "skipped", error: "landing missing" })
        .eq("id", job.id);
      continue;
    }

    const landing = landingRaw as LandingRow;
    const title = landing.course?.title || "קורס";
    const emailType = job.email_type as EmailOutboxType;
    const isReminder = emailType.startsWith("reminder_");
    const baseType = (
      isReminder ? emailType.replace("reminder_", "") : emailType
    ) as PrimaryType;

    let subject = "";
    let html = "";
    let text = "";

    try {
      if (baseType === "course_open") {
        const content = buildCourseOpenEmail({
          courseTitle: title,
          landingUrl: `${origin}/l/${landing.id}`,
          registrantsUrl: `${origin}/dashboard/my/${landing.id}/registrants`,
          bannerUrl:
            landing.assets?.bannerFullUrl || landing.assets?.bannerThumbUrl,
        });
        subject = content.subject;
        html = content.html;
        text = content.text;
      } else {
        const formType = baseType as FormAccessType;
        const rawToken = await issueFormToken(landing.id, formType);
        const formNum = baseType === "form1" ? "1" : baseType === "form2" ? "2" : "3";
        const formUrl = `${origin}/f/${rawToken}/${formNum}`;
        const content = buildFormEmail({
          formLabel: FORM_LABELS[baseType],
          courseTitle: title,
          formUrl,
          isReminder,
        });
        subject = content.subject;
        html = content.html;
        text = content.text;
      }

      const result = await sendEmail({
        to: job.recipient,
        subject,
        html,
        text,
        idempotencyKey: `outbox/${job.id}`,
      });

      if (!result.ok) {
        failed += 1;
        await admin
          .from("email_outbox")
          .update({
            status: "failed",
            error: result.error ?? "send failed",
          })
          .eq("id", job.id);
      } else {
        sent += 1;
        await admin
          .from("email_outbox")
          .update({
            status: result.skipped ? "skipped" : "sent",
            sent_at: new Date().toISOString(),
            provider_message_id: result.id ?? null,
            error: result.skipped ? "RESEND_API_KEY missing" : null,
          })
          .eq("id", job.id);
      }
    } catch (e) {
      failed += 1;
      await admin
        .from("email_outbox")
        .update({
          status: "failed",
          error: e instanceof Error ? e.message : "unknown",
        })
        .eq("id", job.id);
    }
  }

  return { enqueued, sent, failed };
}
