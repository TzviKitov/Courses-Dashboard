import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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
 * Best-effort: return the current user or null. Never throws.
 */
export async function getCurrentUser() {
  try {
    const supabase = await getSupabaseServer();
    const { data } = await supabase.auth.getUser();
    return data.user;
  } catch {
    return null;
  }
}
