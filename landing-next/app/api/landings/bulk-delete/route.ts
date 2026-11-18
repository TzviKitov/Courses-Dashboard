import { isAdmin } from "@/lib/auth/admin";
import { getSupabaseAdmin, isSupabaseDbEnabled } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/ssr";

const MAX_BULK_DELETE = 100;
const SAFE_ID = /^[a-zA-Z0-9_-]{1,64}$/;

/**
 * DELETE /api/landings/bulk-delete
 * Admins may delete any selected courses. Other users may delete only
 * courses they own; co-instructor access is intentionally insufficient.
 */
export async function DELETE(request: Request) {
  if (!isSupabaseDbEnabled()) {
    return Response.json(
      { success: false, error: "מחיקה דורשת חיבור למסד הנתונים" },
      { status: 503 }
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return Response.json(
      { success: false, error: "יש להתחבר כדי למחוק קורסים" },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { success: false, error: "בקשת המחיקה אינה תקינה" },
      { status: 400 }
    );
  }

  const rawIds =
    typeof body === "object" && body !== null && "ids" in body
      ? (body as { ids?: unknown }).ids
      : null;
  if (!Array.isArray(rawIds)) {
    return Response.json(
      { success: false, error: "לא נבחרו קורסים למחיקה" },
      { status: 400 }
    );
  }

  if (
    rawIds.length === 0 ||
    rawIds.length > MAX_BULK_DELETE ||
    rawIds.some((id) => typeof id !== "string" || !SAFE_ID.test(id))
  ) {
    return Response.json(
      { success: false, error: "רשימת הקורסים למחיקה אינה תקינה" },
      { status: 400 }
    );
  }
  const ids = [...new Set(rawIds as string[])];

  const admin = getSupabaseAdmin();
  let authorizationQuery = admin.from("landings").select("id").in("id", ids);
  if (!isAdmin(user)) {
    authorizationQuery = authorizationQuery.eq("owner_id", user.id);
  }

  const { data: authorized, error: authorizationError } =
    await authorizationQuery;
  if (authorizationError) {
    console.error("[bulk-delete] authorization query failed:", authorizationError);
    return Response.json(
      { success: false, error: "לא ניתן לאמת הרשאה למחיקת הקורסים" },
      { status: 500 }
    );
  }

  if (authorized?.length !== ids.length) {
    return Response.json(
      { success: false, error: "אין הרשאה למחוק אחד או יותר מהקורסים שנבחרו" },
      { status: 403 }
    );
  }

  const { error: deleteError } = await admin
    .from("landings")
    .delete()
    .in("id", ids);

  if (deleteError) {
    console.error("[bulk-delete] deletion failed:", deleteError);
    return Response.json(
      { success: false, error: "מחיקת הקורסים נכשלה" },
      { status: 500 }
    );
  }

  return Response.json({ success: true, deletedCount: ids.length });
}
