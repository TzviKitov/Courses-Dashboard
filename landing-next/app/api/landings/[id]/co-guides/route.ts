import { isAdmin, userCanManageLanding } from "@/lib/auth/admin";
import { getSupabaseAdmin, isSupabaseDbEnabled } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/ssr";
import { canEditCoGuides } from "@/lib/landings/co-guide-rules";
import {
  addCoGuideByEmail,
  listCoGuides,
  removeCoGuide,
} from "@/lib/landings/co-guides";
import { logAuditEvent } from "@/lib/security/audit";

async function gate(
  landingId: string,
  mode: "read" | "edit"
): Promise<{ ok: true; userId: string } | { ok: false; response: Response }> {
  if (!isSupabaseDbEnabled()) {
    return {
      ok: false,
      response: Response.json(
        { success: false, error: "נדרש Supabase" },
        { status: 503 }
      ),
    };
  }
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false,
      response: Response.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      ),
    };
  }
  const { data: landing } = await getSupabaseAdmin()
    .from("landings")
    .select("owner_id")
    .eq("id", landingId)
    .maybeSingle();
  if (!landing) {
    return {
      ok: false,
      response: Response.json(
        { success: false, error: "Not found" },
        { status: 404 }
      ),
    };
  }
  const allowed =
    mode === "edit"
      ? canEditCoGuides({
          isAdmin: isAdmin(user),
          userId: user.id,
          ownerId: landing.owner_id,
        })
      : await userCanManageLanding(user, landingId, landing.owner_id);
  if (!allowed) {
    return {
      ok: false,
      response: Response.json(
        {
          success: false,
          error:
            mode === "edit"
              ? "רק מנהל הקורס הראשי יכול להוסיף או להסיר מדריכים"
              : "Forbidden",
        },
        { status: 403 }
      ),
    };
  }
  return { ok: true, userId: user.id };
}

/** List co-guides of a course. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const g = await gate(id, "read");
  if (!g.ok) return g.response;
  return Response.json({ success: true, guides: await listCoGuides(id) });
}

/** Add a co-guide by email. Body: { email } */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const g = await gate(id, "edit");
  if (!g.ok) return g.response;

  let body: { email?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const result = await addCoGuideByEmail({
    landingId: id,
    email: body.email,
    addedBy: g.userId,
  });
  if (!result.ok) {
    return Response.json({ success: false, error: result.error }, { status: 400 });
  }
  logAuditEvent({
    actorId: g.userId,
    action: "co_guide_add",
    resourceType: "landing",
    resourceId: id,
    metadata: { coGuideId: result.guide?.userId },
    req,
  });
  return Response.json({ success: true, guide: result.guide });
}

/** Remove a co-guide. Body: { userId } */
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const g = await gate(id, "edit");
  if (!g.ok) return g.response;

  let body: { userId?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body.userId !== "string" || !body.userId) {
    return Response.json({ success: false, error: "userId required" }, { status: 400 });
  }
  const result = await removeCoGuide(id, body.userId);
  if (!result.ok) {
    return Response.json({ success: false, error: result.error }, { status: 400 });
  }
  logAuditEvent({
    actorId: g.userId,
    action: "co_guide_remove",
    resourceType: "landing",
    resourceId: id,
    metadata: { coGuideId: body.userId },
    req,
  });
  return Response.json({ success: true });
}
