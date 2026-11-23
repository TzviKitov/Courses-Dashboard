export const REFERRAL_MAX_LENGTH = 200;

/** "דרך מי הגעת" is free text (often a guide's or therapist's name). */
export function normalizeReferral(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\s+/g, " ").trim().slice(0, REFERRAL_MAX_LENGTH);
  return cleaned || null;
}
