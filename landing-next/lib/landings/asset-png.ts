import sharp from "sharp";
import { STORAGE_BUCKET } from "@/lib/supabase/server";
import {
  buildAssetUrl,
  contentDisposition,
  downloadFileName,
  storageObjectPath,
  type DownloadKind,
} from "@/lib/landings/download-assets";

const MAX_BYTES = 25 * 1024 * 1024;

/**
 * Fetch one of our own Storage images and answer with a PNG file download.
 * Images are stored as WebP; PNG opens everywhere (WhatsApp, Canva, print shops).
 */
export async function assetPngResponse(
  url: string,
  title: string | undefined,
  kind: DownloadKind
): Promise<Response> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const path = base ? storageObjectPath(url, base, STORAGE_BUCKET) : null;
  if (!base || !path) {
    return Response.json(
      { success: false, error: "כתובת התמונה לא נתמכת" },
      { status: 422 }
    );
  }
  // Fetch a URL built from the validated path, never the caller's URL.
  const upstream = await fetch(buildAssetUrl(base, STORAGE_BUCKET, path), {
    cache: "no-store",
    redirect: "error",
  });
  if (!upstream.ok) {
    return Response.json(
      { success: false, error: "הורדת התמונה נכשלה" },
      { status: 502 }
    );
  }
  const source = Buffer.from(await upstream.arrayBuffer());
  if (source.byteLength > MAX_BYTES) {
    return Response.json(
      { success: false, error: "התמונה גדולה מדי" },
      { status: 413 }
    );
  }
  const png = await sharp(source).png().toBuffer();
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": contentDisposition(downloadFileName(title, kind)),
      "Cache-Control": "private, no-store",
    },
  });
}
