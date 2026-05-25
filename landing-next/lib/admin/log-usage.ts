import { getSupabaseAdmin, isSupabaseDbEnabled } from "@/lib/supabase/server";

export type UsageEventType =
  | "banner_start"
  | "banner_success"
  | "banner_error"
  | "landing_created";

export interface LogUsageEventParams {
  eventType: UsageEventType;
  userId?: string | null;
  landingId?: string | null;
  sessionId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Best-effort usage logging via service role. Never throws to callers.
 */
export async function logUsageEvent(params: LogUsageEventParams): Promise<void> {
  if (!isSupabaseDbEnabled()) return;

  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin.from("usage_events").insert({
      event_type: params.eventType,
      user_id: params.userId ?? null,
      landing_id: params.landingId ?? null,
      session_id: params.sessionId ?? null,
      metadata: params.metadata ?? {},
    });
    if (error) {
      console.warn("[usage_events]", params.eventType, error.message);
    }
  } catch (e) {
    console.warn("[usage_events]", params.eventType, e);
  }
}
