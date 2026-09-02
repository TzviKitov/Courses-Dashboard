import type { User } from "@supabase/supabase-js";
import { isAdmin } from "@/lib/auth/admin";
import { getProfile, type ProfileRow } from "@/lib/auth/profiles";
import { userCanManageLanding } from "@/lib/auth/admin";

export const SENSITIVE_NOTE_FIELDS = [
  "instructor_notes",
  "form1_notes",
  "form2_notes",
  "form3_notes",
  "form3_feedback",
] as const;

export const MAX_NOTES_LENGTH = 2000;

export const NOTES_GUIDANCE_HE =
  "תארו התנהגות בקורס בלבד (למשל: נמנע מהשתתפות, נראה מצוברח אחרי השיעור). אין לתעד אבחנות, תרופות, שמות מטפלים או פרטי משפחה.";

/** Typed as `string` so supabase-js does not try to parse the column list. */
export const REGISTRATION_SELECT_SAFE: string =
  "id, landing_id, full_name, phone, email, referral, notes, cancelled_at, cancellation_reason, acceptance_status, form1_submitted_at, completion_status, form2_submitted_at, placement_status, placement_where, form3_submitted_at, user_id, created_at, birth_year, parent_name, parent_phone, parent_consent_at, marketing_opt_in";

export const REGISTRATION_SELECT_WITH_NOTES: string = `${REGISTRATION_SELECT_SAFE}, instructor_notes, form1_notes, form2_notes, form3_notes, form3_feedback`;

/** List attachments without leaking storage_path to the client. */
export const ATTACHMENT_LIST_SELECT: string =
  "id, registration_id, landing_id, file_name, mime_type, size_bytes, created_at, created_by";

export function stripSensitiveNotes<T extends Record<string, unknown>>(
  row: T
): T {
  const copy = { ...row };
  for (const field of SENSITIVE_NOTE_FIELDS) {
    if (field in copy) {
      (copy as Record<string, unknown>)[field] = null;
    }
  }
  return copy;
}

export function clampNotes(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_NOTES_LENGTH);
}

export function coerceRows<T>(data: unknown): T[] {
  return (Array.isArray(data) ? data : []) as T[];
}

export async function viewerCanSeeSensitiveNotes(
  user: User | null | undefined,
  landingId?: string,
  ownerId?: string | null
): Promise<boolean> {
  if (!user) return false;
  const profile = await getProfile(user.id);
  if (!profile) return false;
  if (isAdmin(user)) {
    return Boolean(profile.can_view_sensitive_notes);
  }
  if (!profile.can_view_sensitive_notes) return false;
  if (landingId) {
    return userCanManageLanding(user, landingId, ownerId);
  }
  return profile.role === "instructor" && profile.status === "active";
}

export function profileCanExportRegistrants(profile: ProfileRow | null): boolean {
  if (!profile) return false;
  if (profile.status === "disabled") return false;
  return profile.can_export_registrants !== false;
}

export function profileCanExportSensitiveNotes(profile: ProfileRow | null): boolean {
  if (!profile) return false;
  if (profile.status === "disabled") return false;
  return Boolean(profile.can_export_sensitive_notes);
}

export function csvHeaders(includeNotes: boolean): string[] {
  const base = [
    "created_at",
    "full_name",
    "phone",
    "email",
    "referral",
    "notes",
    "cancelled_at",
    "cancellation_reason",
    "acceptance_status",
    "completion_status",
    "placement_status",
    "placement_where",
    "birth_year",
    "marketing_opt_in",
  ];
  if (!includeNotes) return base;
  return [
    ...base,
    "instructor_notes",
    "form1_notes",
    "form2_notes",
    "form3_feedback",
    "form3_notes",
  ];
}
