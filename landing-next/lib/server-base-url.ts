import { headers } from "next/headers";

function trimTrailingSlash(url: string): string {
  return url.replace(/\/$/, "");
}

/**
 * Resolve the public site base URL for server-side self-fetch and absolute links.
 * Priority: NEXT_PUBLIC_BASE_URL → VERCEL_URL → request Host headers → localhost.
 */
export function getServerBaseUrlFromEnv(): string | null {
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return trimTrailingSlash(process.env.NEXT_PUBLIC_BASE_URL);
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return null;
}

/** For Server Components / server actions (no Request object). */
export async function getServerBaseUrl(): Promise<string> {
  const fromEnv = getServerBaseUrlFromEnv();
  if (fromEnv) return fromEnv;

  try {
    const headersList = await headers();
    const host =
      headersList.get("x-forwarded-host") ?? headersList.get("host");
    const proto = headersList.get("x-forwarded-proto") ?? "https";
    if (host) return `${proto}://${host}`;
  } catch {
    // headers() unavailable outside a request context
  }

  return "http://localhost:3000";
}

/** For Route Handlers that receive a Request. */
export function getServerBaseUrlFromRequest(req: Request): string {
  const fromEnv = getServerBaseUrlFromEnv();
  if (fromEnv) return fromEnv;
  return new URL(req.url).origin;
}
