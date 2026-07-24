import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { cache } from "react";

/**
 * Supabase client wired into Next.js cookies for authenticated requests.
 * Use this in Server Components and Route Handlers where the request has
 * a logged-in user (Wave 3).
 */
export async function getSupabaseServer() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing Supabase env vars. See SUPABASE_SETUP.md.");
  }

  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll().map((c) => ({ name: c.name, value: c.value })),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component; mutations not allowed.
          // The middleware refreshes the session, so this is fine.
        }
      },
    },
  });
}

/**
 * Supabase client for Route Handlers that return redirects.
 * Writes session cookies to both the request cookie store AND the outgoing
 * response so the browser receives Set-Cookie (required in Next.js 15+).
 */
export async function createSupabaseRouteHandlerClient(
  response: NextResponse
): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing Supabase env vars. See SUPABASE_SETUP.md.");
  }

  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll().map((c) => ({ name: c.name, value: c.value })),
      setAll: (toSet) => {
        for (const { name, value, options } of toSet) {
          try {
            cookieStore.set(name, value, options);
          } catch {
            // Server Component context — ignore.
          }
          response.cookies.set(name, value, options);
        }
      },
    },
  });
}

/**
 * Base URL for auth redirects (OAuth callback, sign-out).
 * On localhost, always prefer the request origin so a production
 * NEXT_PUBLIC_BASE_URL (or Supabase Site URL confusion) cannot hijack local login.
 */
export function getAuthOrigin(request: Request): string {
  const requestOrigin = new URL(request.url).origin;
  if (
    requestOrigin.includes("localhost") ||
    requestOrigin.includes("127.0.0.1")
  ) {
    return requestOrigin;
  }
  const configured = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "");
  return configured || requestOrigin;
}

/**
 * Best-effort: return the current user or null. Never throws.
 * Cached per React request so assertPageAccess + page + DashboardNav
 * share one Auth round-trip instead of 3.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  try {
    const supabase = await getSupabaseServer();
    const { data } = await supabase.auth.getUser();
    return data.user;
  } catch {
    return null;
  }
});
