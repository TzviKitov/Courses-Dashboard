import { headers } from "next/headers";

/**
 * Server-side fetch to admin API routes with session cookies forwarded.
 */
export async function fetchAdminApi<T>(path: string): Promise<T | null> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const headersList = await headers();
  const cookie = headersList.get("cookie") ?? "";

  try {
    const r = await fetch(`${baseUrl}${path}`, {
      cache: "no-store",
      headers: cookie ? { cookie } : {},
    });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}
