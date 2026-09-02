import { getSupabaseAdmin, isSupabaseDbEnabled } from "@/lib/supabase/server";
import {
  clientIpFromRequest,
  userAgentFromRequest,
} from "@/lib/security/request-meta";

export type AuditAction =
  | "login_success"
  | "login_failure"
  | "logout"
  | "role_change"
  | "status_change"
  | "view_registrants"
  | "view_learner"
  | "view_notes"
  | "update_notes"
  | "export_csv"
  | "upload_file"
  | "download_file"
  | "delete_file"
  | "delete_resource"
  | "data_request"
  | "register"
  | "security_alert";

export interface AuditInput {
  actorId?: string | null;
  action: AuditAction | string;
  resourceType?: string;
  resourceId?: string;
  ip?: string;
  userAgent?: string;
  result?: "ok" | "denied" | "error";
  metadata?: Record<string, unknown>;
  req?: Request;
}

/** Fire-and-forget audit write. Never throws to the caller. */
export function logAuditEvent(input: AuditInput): void {
  void persistAudit(input).catch((err) => {
    console.error("[audit] write failed:", err);
  });
}

export async function persistAudit(input: AuditInput): Promise<void> {
  if (!isSupabaseDbEnabled()) return;
  const ip = input.ip ?? (input.req ? clientIpFromRequest(input.req) : null);
  const userAgent =
    input.userAgent ?? (input.req ? userAgentFromRequest(input.req) : null);

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("audit_events").insert({
    actor_id: input.actorId ?? null,
    action: input.action,
    resource_type: input.resourceType ?? null,
    resource_id: input.resourceId ?? null,
    ip_address: ip,
    user_agent: userAgent,
    result: input.result ?? "ok",
    metadata: input.metadata ?? {},
  });
  if (error) {
    console.error("[audit] insert:", error.message);
  }
}

export const AUDIT_RETENTION_MONTHS = 24;

export async function pruneAuditEventsOlderThanRetention(): Promise<number> {
  if (!isSupabaseDbEnabled()) return 0;
  const cutoff = new Date();
  cutoff.setUTCMonth(cutoff.getUTCMonth() - AUDIT_RETENTION_MONTHS);
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("audit_events")
    .delete()
    .lt("created_at", cutoff.toISOString())
    .select("id");
  if (error) {
    console.error("[audit] prune failed:", error.message);
    return 0;
  }
  return data?.length ?? 0;
}
