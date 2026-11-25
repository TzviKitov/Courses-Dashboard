/**
 * Content-Security-Policy with a per-request nonce.
 *
 * Scripts run only if they carry the nonce (or were loaded by one that does),
 * so injected inline script is blocked. Styles keep 'unsafe-inline' because
 * React/Next emit style attributes; that is the standard trade-off.
 */
export function buildCsp(nonce: string, opts: { dev?: boolean } = {}): string {
  const dev = Boolean(opts.dev);
  const script = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    // Next's dev tooling needs eval; production does not.
    ...(dev ? ["'unsafe-eval'"] : []),
  ].join(" ");

  return [
    "default-src 'self'",
    `script-src ${script}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

/** 128-bit random nonce, base64. */
export function newNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
