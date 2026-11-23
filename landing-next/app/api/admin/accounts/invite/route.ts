import { requireAdminApi } from "@/lib/admin/require-admin";
import { inviteInstructor } from "@/lib/admin/invite-instructor";
import { getAuthOrigin } from "@/lib/supabase/ssr";
import { normalizeIsraeliPhone } from "@/lib/auth/phone";

/** Admin invites a new instructor (email + magic link to set password). */
export async function POST(req: Request) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  let body: {
    email?: string;
    displayName?: string;
    role?: "instructor" | "admin";
    phone?: string;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return Response.json({ success: false, error: "Email required" }, { status: 400 });
  }
  const role = body.role === "admin" ? "admin" : "instructor";
  const displayName = body.displayName?.trim() || email.split("@")[0];
  const phone =
    typeof body.phone === "string" && body.phone.trim()
      ? normalizeIsraeliPhone(body.phone)
      : null;
  if (typeof body.phone === "string" && body.phone.trim() && !phone) {
    return Response.json(
      { success: false, error: "מספר נייד ישראלי לא תקין" },
      { status: 400 }
    );
  }

  const result = await inviteInstructor({
    email,
    displayName,
    role,
    phone,
    origin: getAuthOrigin(req),
    actorId: gate.user.id,
    req,
  });
  if (!result.ok) {
    return Response.json({ success: false, error: result.error }, { status: 400 });
  }
  return Response.json({
    success: true,
    userId: result.userId,
    ...(result.warning ? { warning: result.warning } : {}),
  });
}
