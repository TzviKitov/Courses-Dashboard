export const dynamic = "force-dynamic";

import { requireAdminApi } from "@/lib/admin/require-admin";
import { deleteBrandLogo } from "@/lib/logos/library";
import { logAuditEvent } from "@/lib/security/audit";
import { isSupabaseDbEnabled } from "@/lib/supabase/server";

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  if (!isSupabaseDbEnabled()) {
    return Response.json(
      { success: false, error: "נדרש USE_SUPABASE_DB=true." },
      { status: 400 }
    );
  }

  const { id } = await ctx.params;
  const logoId = decodeURIComponent(id || "").trim();
  if (!logoId) {
    return Response.json({ success: false, error: "חסר מזהה לוגו." }, { status: 400 });
  }

  try {
    await deleteBrandLogo(logoId);
    logAuditEvent({
      actorId: gate.user.id,
      action: "delete_resource",
      resourceType: "brand_logo",
      resourceId: logoId,
      req,
    });
    return Response.json({ success: true });
  } catch (error) {
    console.error("admin logo delete:", error);
    const message = error instanceof Error ? error.message : "";
    if (message === "MISSING_TABLE" || message.includes("brand_logos")) {
      return Response.json(
        {
          success: false,
          error: "יש להריץ את db/schema-logos.sql בעורך SQL של Supabase.",
          tableMissing: true,
        },
        { status: 400 }
      );
    }
    return Response.json(
      { success: false, error: "לא ניתן להסיר את הלוגו." },
      { status: 500 }
    );
  }
}
