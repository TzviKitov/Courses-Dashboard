import { getSupabaseAdmin, isSupabaseDbEnabled } from "@/lib/supabase/server";
import { hashRateLimitKey } from "@/lib/security/request-meta";

export class RateLimitError extends Error {
  retryAfterSec: number;
  constructor(retryAfterSec: number) {
    super("rate_limited");
    this.retryAfterSec = retryAfterSec;
  }
}

export async function assertRateLimit(opts: {
  bucket: string;
  key: string;
  max: number;
  windowSec: number;
}): Promise<void> {
  if (!isSupabaseDbEnabled()) return;

  const admin = getSupabaseAdmin();
  const keyHash = hashRateLimitKey(`${opts.bucket}:${opts.key}`);
  const since = new Date(Date.now() - opts.windowSec * 1000).toISOString();

  const { count, error } = await admin
    .from("rate_limit_events")
    .select("id", { count: "exact", head: true })
    .eq("bucket", opts.bucket)
    .eq("key_hash", keyHash)
    .gte("created_at", since);

  if (error) {
    console.error("[rate-limit] count failed:", error.message);
    return;
  }

  if ((count ?? 0) >= opts.max) {
    throw new RateLimitError(opts.windowSec);
  }

  const { error: insertError } = await admin.from("rate_limit_events").insert({
    bucket: opts.bucket,
    key_hash: keyHash,
  });
  if (insertError) {
    console.error("[rate-limit] insert failed:", insertError.message);
  }
}

export function rateLimitResponse(err: RateLimitError): Response {
  return Response.json(
    {
      success: false,
      error: "יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.",
      code: "RATE_LIMITED",
    },
    {
      status: 429,
      headers: { "Retry-After": String(err.retryAfterSec) },
    }
  );
}

export async function pruneRateLimitEvents(olderThanHours = 48): Promise<number> {
  if (!isSupabaseDbEnabled()) return 0;
  const admin = getSupabaseAdmin();
  const cutoff = new Date(Date.now() - olderThanHours * 3600 * 1000).toISOString();
  const { data, error } = await admin
    .from("rate_limit_events")
    .delete()
    .lt("created_at", cutoff)
    .select("id");
  if (error) {
    console.error("[rate-limit] prune failed:", error.message);
    return 0;
  }
  return data?.length ?? 0;
}
