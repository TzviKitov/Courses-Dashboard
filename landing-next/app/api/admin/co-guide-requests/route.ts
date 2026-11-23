import { requireAdminApi } from "@/lib/admin/require-admin";
import { getAuthOrigin } from "@/lib/supabase/ssr";
import {
  decideCoGuideRequest,
  listPendingRequests,
} from "@/lib/landings/co-guide-requests";

/** Admin: open co-guide requests. */
export async function GET() {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;
  return Response.json({ success: true, items: await listPendingRequests() });
}

/** Admin: approve (adds the guide and emails an invite if needed) or reject. Body: { id, action } */
export async function POST(req: Request) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  let body: { id?: unknown; action?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }
  if (
    typeof body.id !== "string" ||
    (body.action !== "approve" && body.action !== "reject")
  ) {
    return Response.json(
      { success: false, error: "id and action (approve|reject) required" },
      { status: 400 }
    );
  }

  const result = await decideCoGuideRequest({
    requestId: body.id,
    action: body.action,
    adminId: gate.user.id,
    origin: getAuthOrigin(req),
    req,
  });
  if (!result.ok) {
    return Response.json({ success: false, error: result.error }, { status: 400 });
  }
  return Response.json({
    success: true,
    invited: Boolean(result.invited),
    ...(result.warning ? { warning: result.warning } : {}),
  });
}
