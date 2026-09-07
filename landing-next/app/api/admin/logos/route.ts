export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { requireAdminApi } from "@/lib/admin/require-admin";
import {
  createBrandLogo,
  listBrandLogosAdmin,
  parseLogoTags,
} from "@/lib/logos/library";
import { logAuditEvent } from "@/lib/security/audit";
import { isAllowedLogoImage } from "@/lib/security/file-magic";
import { assertRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { clientIpFromRequest } from "@/lib/security/request-meta";
import { isSupabaseDbEnabled } from "@/lib/supabase/server";

const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
  "image/svg",
]);

export async function GET() {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  try {
    const result = await listBrandLogosAdmin();
    return Response.json({
      success: true,
      items: result.items,
      source: result.source,
      tableMissing: result.tableMissing,
    });
  } catch (error) {
    console.error("admin logos list:", error);
    return Response.json(
      { success: false, error: "לא ניתן לטעון את ספריית הלוגואים" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  if (!isSupabaseDbEnabled()) {
    return Response.json(
      { success: false, error: "נדרש USE_SUPABASE_DB=true." },
      { status: 400 }
    );
  }

  try {
    await assertRateLimit({
      bucket: "admin-logo-upload",
      key: `${gate.user.id}:${clientIpFromRequest(req)}`,
      max: 40,
      windowSec: 3600,
    });
  } catch (err) {
    if (err instanceof RateLimitError) {
      return Response.json(
        { success: false, error: "יותר מדי ניסיונות. נסו שוב בעוד כמה דקות." },
        { status: 429 }
      );
    }
    throw err;
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ success: false, error: "Invalid form data" }, { status: 400 });
  }

  const name = String(form.get("name") || "").trim();
  if (!name || name.length > 80) {
    return Response.json(
      { success: false, error: "יש להזין שם לוגו (עד 80 תווים)." },
      { status: 400 }
    );
  }

  const tags = parseLogoTags(String(form.get("tags") || ""));
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ success: false, error: "יש לבחור קובץ לוגו." }, { status: 400 });
  }

  if (!ALLOWED.has(file.type)) {
    return Response.json(
      { success: false, error: "סוג קובץ לא נתמך. השתמשו ב-PNG, SVG, JPG או WebP." },
      { status: 400 }
    );
  }

  if (file.size > MAX_BYTES) {
    return Response.json(
      { success: false, error: "הקובץ גדול מדי (מקסימום 4MB)." },
      { status: 400 }
    );
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!isAllowedLogoImage(bytes, file.type)) {
      return Response.json(
        { success: false, error: "תוכן הקובץ אינו תואם לסוג המוצהר." },
        { status: 400 }
      );
    }

    const item = await createBrandLogo({ name, tags, bytes });
    logAuditEvent({
      actorId: gate.user.id,
      action: "upload_file",
      resourceType: "brand_logo",
      resourceId: item.id,
      req,
      metadata: { name },
    });
    return Response.json({ success: true, item });
  } catch (error) {
    console.error("admin logo create:", error);
    const message = error instanceof Error ? error.message : "";
    if (message.includes("brand_logos") || message.includes("schema cache")) {
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
      {
        success: false,
        error: "העלאת הלוגו נכשלה. בדקו שהקובץ תקין ונסו שוב.",
      },
      { status: 500 }
    );
  }
}
