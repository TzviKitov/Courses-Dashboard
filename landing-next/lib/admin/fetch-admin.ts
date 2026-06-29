import { headers } from "next/headers";
import { getServerBaseUrl } from "@/lib/server-base-url";

/**
 * Server-side fetch to admin API routes with session cookies forwarded.
 */
export async function fetchAdminApi<T>(path: string): Promise<T | null> {
  const baseUrl = await getServerBaseUrl();
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
