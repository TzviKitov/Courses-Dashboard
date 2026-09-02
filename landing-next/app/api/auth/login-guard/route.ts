import { clientIpFromRequest } from "@/lib/security/request-meta";
import { logAuditEvent } from "@/lib/security/audit";
import {
  assertRateLimit,
  RateLimitError,
  rateLimitResponse,
} from "@/lib/security/rate-limit";

export async function POST(req: Request) {
  let body: { email?: string; result?: "ok" | "fail" };
  try {
    body = await req.json();
  } catch {
    return Response.json({ success: false }, { status: 400 });
  }
  const email = (body.email || "").trim().toLowerCase();
  const ip = clientIpFromRequest(req);
  const key = `${email || "unknown"}:${ip}`;

  if (body.result === "fail") {
    logAuditEvent({
      action: "login_failure",
      metadata: { emailHash: email ? email.slice(0, 3) : null },
      req,
    });
    try {
      await assertRateLimit({
        bucket: "login-fail",
        key,
        max: 5,
        windowSec: 15 * 60,
      });
    } catch (err) {
      if (err instanceof RateLimitError) return rateLimitResponse(err);
    }
    return Response.json({ success: true });
  }

  try {
    await assertRateLimit({
      bucket: "login-check",
      key,
      max: 5,
      windowSec: 15 * 60,
    });
  } catch (err) {
    if (err instanceof RateLimitError) return rateLimitResponse(err);
  }
  return Response.json({ success: true });
}
