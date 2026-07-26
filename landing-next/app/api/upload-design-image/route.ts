export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { uploadImageVariants } from "@/lib/supabase/storage";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/ssr";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/**
 * POST multipart: file + optional sessionId + kind (flyer|inspiration)
 * Uploads WebP variants under tmp/{sessionId}/ and returns public URLs.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Supabase Storage לא מוגדר. הוסף NEXT_PUBLIC_SUPABASE_URL ו-SUPABASE_SERVICE_ROLE_KEY.",
      },
      { status: 500 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Missing file" }, { status: 400 });
  }

  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(
      { ok: false, error: "סוג קובץ לא נתמך. השתמש ב-JPG, PNG או WebP." },
      { status: 400 }
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: "הקובץ גדול מדי (מקסימום 8MB)." },
      { status: 400 }
    );
  }

  const kindRaw = String(form.get("kind") || "flyer");
  const kind = kindRaw === "inspiration" ? "inspiration" : "flyer";
  const existingSession = String(form.get("sessionId") || "").trim();
  const sessionId =
    existingSession ||
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const storagePrefix = `tmp/${sessionId}`;

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const variants = await uploadImageVariants({
      prefix: storagePrefix,
      name: kind,
      bytes,
    });

    return NextResponse.json({
      ok: true,
      sessionId,
      url: variants.fullUrl,
      thumbUrl: variants.thumbUrl,
      kind,
    });
  } catch (e) {
    console.error("upload-design-image failed:", e);
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Upload failed",
      },
      { status: 500 }
    );
  }
}
