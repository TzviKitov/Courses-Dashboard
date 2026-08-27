/**
 * Password strength rules for instructor / email sign-up.
 */

export const PASSWORD_REQUIREMENTS = [
  { id: "length", label: "לפחות 8 תווים", test: (p: string) => p.length >= 8 },
  {
    id: "upper",
    label: "אות גדולה באנגלית (A-Z)",
    test: (p: string) => /[A-Z]/.test(p),
  },
  {
    id: "lower",
    label: "אות קטנה באנגלית (a-z)",
    test: (p: string) => /[a-z]/.test(p),
  },
  { id: "digit", label: "ספרה (0-9)", test: (p: string) => /\d/.test(p) },
  {
    id: "special",
    label: "תו מיוחד (!@#$%^&* וכו')",
    test: (p: string) => /[^A-Za-z0-9]/.test(p),
  },
] as const;

export function validatePassword(password: string): {
  ok: boolean;
  failed: string[];
} {
  const failed = PASSWORD_REQUIREMENTS.filter((r) => !r.test(password)).map(
    (r) => r.label
  );
  return { ok: failed.length === 0, failed };
}
