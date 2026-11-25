"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient {
  if (browserClient) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Missing Supabase public env vars");
  }
  // Talk to Supabase through this site's /sb proxy (rewrite in next.config.ts)
  // so the browser never calls *.supabase.co directly. The cookie name stays the
  // one derived from the real project URL, so the server still reads the session.
  const ref = new URL(url).hostname.split(".")[0];
  const viaSite =
    typeof window !== "undefined" ? `${window.location.origin}/sb` : url;
  browserClient = createBrowserClient(viaSite, anonKey, {
    cookieOptions: { name: `sb-${ref}-auth-token` },
  });
  return browserClient;
}
