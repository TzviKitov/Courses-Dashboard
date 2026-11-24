/**
 * Email scanners (corporate gateways, Safe Links) open every link in a mail with a
 * plain GET. Supabase's `action_link` signs the user in on that GET and the token is
 * single-use, so the scanner burns it before the person ever sees the mail.
 *
 * This link points at our own page instead. The token is only spent when the person
 * presses the button (a script action that scanners do not perform).
 */
export function buildSafeRecoveryLink(
  origin: string,
  linkData: {
    properties?: { hashed_token?: string; action_link?: string } | null;
    action_link?: string;
  } | null
): string | null {
  const hashed = linkData?.properties?.hashed_token;
  if (hashed) {
    const base = origin.replace(/\/$/, "");
    return `${base}/auth/accept?token_hash=${encodeURIComponent(hashed)}&type=recovery`;
  }
  return linkData?.properties?.action_link || linkData?.action_link || null;
}
