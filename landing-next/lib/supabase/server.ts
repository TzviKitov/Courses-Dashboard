import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | null = null;
let anonClient: SupabaseClient | null = null;

/**
 * Server-side Supabase client with the service role key.
 * NEVER import this in client components - it bypasses RLS.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (adminClient) return adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY). " +
        "See SUPABASE_SETUP.md."
    );
  }

  adminClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}

/**
 * Server-side Supabase client with the anon key.
 * Respects RLS - safe for public reads.
 */
export function getSupabaseAnon(): SupabaseClient {
  if (anonClient) return anonClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY). " +
        "See SUPABASE_SETUP.md."
    );
  }

  anonClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return anonClient;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/**
 * Renamed from useSupabaseDb to avoid being misidentified as a React hook
 * by eslint-plugin-react-hooks (any identifier starting with `use` is treated
 * as a hook by the plugin's rules).
 */
export function isSupabaseDbEnabled(): boolean {
  return (
    isSupabaseConfigured() && process.env.USE_SUPABASE_DB === "true"
  );
}

// Trim: Vercel/dashboard pastes sometimes include leading tab/newline, which
// becomes part of the public URL (`.../public/%09%0Acourse-media/...`) and
// yields "Bucket not found" even when the real bucket exists and is public.
export const STORAGE_BUCKET = (
  process.env.SUPABASE_STORAGE_BUCKET || "course-media"
).trim();
