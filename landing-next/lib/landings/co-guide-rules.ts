import { organizationsCompatible } from "../security/org-scope-rules";

export interface CoGuideCandidate {
  userId: string;
  role: string;
  status: string;
  organizationId: string | null;
}

export type CoGuideCheck = { ok: true } | { ok: false; error: string };

/** Who may add or remove co-guides: the owner and admins only. */
export function canEditCoGuides(input: {
  isAdmin: boolean;
  userId: string;
  ownerId: string | null | undefined;
}): boolean {
  if (input.isAdmin) return true;
  return Boolean(input.ownerId) && input.ownerId === input.userId;
}

/** Co-guides get access to the course's registrants, so only active guides qualify. */
export function checkCoGuideCandidate(
  candidate: CoGuideCandidate | null,
  ctx: {
    ownerId: string | null | undefined;
    landingOrgId: string | null | undefined;
  }
): CoGuideCheck {
  if (!candidate) {
    return {
      ok: false,
      error:
        "לא מצאנו מדריך רשום עם המייל הזה. הוא צריך קודם להירשם לאתר כמדריך.",
    };
  }
  if (
    candidate.status !== "active" ||
    (candidate.role !== "instructor" && candidate.role !== "admin")
  ) {
    return { ok: false, error: "אפשר להוסיף רק מדריך פעיל או מנהל." };
  }
  if (ctx.ownerId && candidate.userId === ctx.ownerId) {
    return { ok: false, error: "המדריך הזה כבר מנהל הראשי של הקורס." };
  }
  if (!organizationsCompatible(candidate.organizationId, ctx.landingOrgId)) {
    return { ok: false, error: "המדריך שייך לארגון אחר." };
  }
  return { ok: true };
}

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254
    ? email
    : null;
}
