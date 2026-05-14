import sharp from "sharp";
import { getSupabaseAdmin, STORAGE_BUCKET, isSupabaseConfigured } from "./server";

export interface ImageVariants {
  fullUrl: string;
  thumbUrl: string;
}

interface UploadVariantsOptions {
  /** Storage path prefix, e.g. `tmp/abc123` or `courses/landingId`. No trailing slash. */
  prefix: string;
  /** Logical name, e.g. `banner` or `hero`. */
  name: string;
  /** Raw image bytes (PNG/JPEG/etc, whatever Gemini returned). */
  bytes: Uint8Array;
  /** Max width for the full variant in pixels. Default 1920. */
  fullMaxWidth?: number;
  /** Fixed width for the thumb variant in pixels. Default 480. */
  thumbWidth?: number;
  /** WebP quality (0-100). Default 85. */
  quality?: number;
}

/**
 * Convert bytes to two WebP variants (full + thumb) and upload to Storage.
 * Returns public URLs for both.
 */
export async function uploadImageVariants(
  options: UploadVariantsOptions
): Promise<ImageVariants> {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase Storage is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  const {
    prefix,
    name,
    bytes,
    fullMaxWidth = 1920,
    thumbWidth = 480,
    quality = 85,
  } = options;

  const buffer = Buffer.from(bytes);

  const fullBuffer = await sharp(buffer)
    .resize({ width: fullMaxWidth, withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();

  const thumbBuffer = await sharp(buffer)
    .resize({ width: thumbWidth, withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();

  const admin = getSupabaseAdmin();
  const fullPath = `${prefix}/${name}-full.webp`;
  const thumbPath = `${prefix}/${name}-thumb.webp`;

  const uploads = await Promise.all([
    admin.storage
      .from(STORAGE_BUCKET)
      .upload(fullPath, fullBuffer, {
        contentType: "image/webp",
        upsert: true,
        cacheControl: "31536000",
      }),
    admin.storage
      .from(STORAGE_BUCKET)
      .upload(thumbPath, thumbBuffer, {
        contentType: "image/webp",
        upsert: true,
        cacheControl: "31536000",
      }),
  ]);

  for (const result of uploads) {
    if (result.error) {
      throw new Error(`Storage upload failed: ${result.error.message}`);
    }
  }

  return {
    fullUrl: getPublicUrl(fullPath),
    thumbUrl: getPublicUrl(thumbPath),
  };
}

/**
 * Move (copy+delete) all files under `fromPrefix/` to `toPrefix/` in Storage.
 * Used when finalizing a landing (tmp/sessionId/* -> courses/landingId/*).
 */
export async function moveStoragePrefix(
  fromPrefix: string,
  toPrefix: string
): Promise<{ moved: string[]; errors: string[] }> {
  const admin = getSupabaseAdmin();
  const bucket = admin.storage.from(STORAGE_BUCKET);

  const { data: files, error: listError } = await bucket.list(fromPrefix, {
    limit: 100,
  });

  if (listError) {
    return { moved: [], errors: [listError.message] };
  }

  if (!files || files.length === 0) {
    return { moved: [], errors: [] };
  }

  const moved: string[] = [];
  const errors: string[] = [];

  for (const file of files) {
    if (!file.name) continue;
    const fromPath = `${fromPrefix}/${file.name}`;
    const toPath = `${toPrefix}/${file.name}`;
    const { error: moveError } = await bucket.move(fromPath, toPath);
    if (moveError) {
      errors.push(`${fromPath} -> ${toPath}: ${moveError.message}`);
    } else {
      moved.push(toPath);
    }
  }

  return { moved, errors };
}

/**
 * Rewrite a public URL pointing at `tmp/{session}/{file}` to `courses/{landingId}/{file}`.
 * Returns the URL unchanged if it does not match the expected pattern.
 */
export function rewriteStorageUrl(
  url: string | undefined,
  fromPrefix: string,
  toPrefix: string
): string {
  if (!url) return "";
  return url.replace(`/${fromPrefix}/`, `/${toPrefix}/`);
}

function getPublicUrl(path: string): string {
  const admin = getSupabaseAdmin();
  const { data } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export function getStoragePublicUrl(path: string): string {
  return getPublicUrl(path);
}

/**
 * Upload a single buffer (already-encoded image, no transformation).
 * Used by the migration script for legacy base64 -> WebP conversion.
 */
export async function uploadBuffer(
  path: string,
  bytes: Uint8Array,
  contentType: string
): Promise<string> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase Storage is not configured.");
  }
  const admin = getSupabaseAdmin();
  const { error } = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(path, Buffer.from(bytes), {
      contentType,
      upsert: true,
      cacheControl: "31536000",
    });
  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }
  return getPublicUrl(path);
}
