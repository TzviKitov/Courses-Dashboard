/** Safe relative redirect target for post sign-in (no open redirects). */
export function sanitizeRedirectPath(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) return "/dashboard";
  if (path.startsWith("/auth/")) {
    if (
      path.startsWith("/auth/pending") ||
      path.startsWith("/auth/set-password") ||
      path.startsWith("/auth/register") ||
      path.startsWith("/auth/mfa") ||
      path.startsWith("/auth/mfa-sms")
    ) {
      return path;
    }
    return "/dashboard";
  }
  return path;
}

export function signInRedirectUrl(returnPath: string): string {
  const safe = sanitizeRedirectPath(returnPath);
  return `/auth/login?redirect=${encodeURIComponent(safe)}`;
}
