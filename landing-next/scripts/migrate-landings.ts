/**
 * One-shot migration: data/landings/*.json -> Supabase Storage + landings table.
 *
 * Behavior:
 *  - Decodes base64-encoded assets (data:image/...;base64,...) and uploads as WebP variants.
 *  - Skips assets that are stale blob: URLs (those are unrecoverable; just logs and continues).
 *  - Inserts each landing into the Supabase `landings` table (idempotent: upsert by id).
 *  - Rewrites the JSON file in place with clean URLs so they remain valid as fallback.
 *
 * Usage:
 *   npm run migrate:landings
 *
 * Requires:
 *   - .env.local with NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *     SUPABASE_STORAGE_BUCKET (default: course-media)
 *   - The bucket and schema must already exist (see SUPABASE_SETUP.md).
 */
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

// Manually load .env.local since this script runs outside Next.js runtime.
async function loadEnv(): Promise<void> {
  const envPath = join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  const content = await readFile(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

interface LegacyLanding {
  id: string;
  course?: Record<string, unknown>;
  assets?: {
    bannerUrl?: string;
    bannerThumbUrl?: string;
    backgroundUrl?: string;
    backgroundThumbUrl?: string;
  };
  theme?: Record<string, unknown>;
  form?: Record<string, unknown>;
  metadata?: {
    start_date?: string | null;
    price?: number | null;
    sector?: string | null;
    target_audience_tags?: string[];
  };
  createdAt?: string;
}

interface MigrationStats {
  migrated: string[];
  skipped: string[];
  errors: { id: string; error: string }[];
}

function isBase64DataUrl(url: string | undefined): url is string {
  return Boolean(url && url.startsWith("data:image/") && url.includes(";base64,"));
}

function isBlobUrl(url: string | undefined): url is string {
  return Boolean(url && url.startsWith("blob:"));
}

function decodeBase64Url(url: string): { bytes: Uint8Array; mime: string } {
  const match = url.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid base64 data URL");
  const buffer = Buffer.from(match[2], "base64");
  return { bytes: new Uint8Array(buffer), mime: match[1] };
}

async function migrateOne(
  filePath: string,
  landing: LegacyLanding,
  stats: MigrationStats
): Promise<void> {
  const { id } = landing;
  if (!id) {
    stats.errors.push({ id: filePath, error: "Missing id" });
    return;
  }

  // Lazy import to ensure env vars are loaded first.
  const { uploadImageVariants } = await import("../lib/supabase/storage");
  const { getSupabaseAdmin } = await import("../lib/supabase/server");

  const assets = landing.assets || {};
  let bannerFullUrl: string | undefined = assets.bannerUrl;
  let bannerThumbUrl: string | undefined = assets.bannerThumbUrl;
  let backgroundFullUrl: string | undefined = assets.backgroundUrl;
  let backgroundThumbUrl: string | undefined = assets.backgroundThumbUrl;

  const targetPrefix = `courses/${id}`;

  // Migrate banner if base64
  if (isBase64DataUrl(assets.bannerUrl)) {
    const { bytes } = decodeBase64Url(assets.bannerUrl);
    console.log(`[${id}] uploading banner (${bytes.length} bytes)...`);
    const variants = await uploadImageVariants({
      prefix: targetPrefix,
      name: "banner",
      bytes,
    });
    bannerFullUrl = variants.fullUrl;
    bannerThumbUrl = variants.thumbUrl;
  } else if (isBlobUrl(assets.bannerUrl)) {
    console.warn(`[${id}] bannerUrl is a stale blob: URL - skipping (unrecoverable).`);
    bannerFullUrl = undefined;
    bannerThumbUrl = undefined;
  }

  // Migrate background if base64
  if (isBase64DataUrl(assets.backgroundUrl)) {
    const { bytes } = decodeBase64Url(assets.backgroundUrl);
    console.log(`[${id}] uploading background (${bytes.length} bytes)...`);
    const variants = await uploadImageVariants({
      prefix: targetPrefix,
      name: "hero",
      bytes,
    });
    backgroundFullUrl = variants.fullUrl;
    backgroundThumbUrl = variants.thumbUrl;
  } else if (isBlobUrl(assets.backgroundUrl)) {
    console.warn(`[${id}] backgroundUrl is a stale blob: URL - skipping.`);
    backgroundFullUrl = undefined;
    backgroundThumbUrl = undefined;
  }

  // Upsert into landings table
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("landings").upsert(
    {
      id,
      course: landing.course || {},
      assets: {
        bannerFullUrl,
        bannerThumbUrl,
        backgroundFullUrl,
        backgroundThumbUrl,
      },
      theme: landing.theme || {},
      form: landing.form || {},
      is_public: true,
      start_date: landing.metadata?.start_date || null,
      price: landing.metadata?.price ?? null,
      sector: landing.metadata?.sector ?? null,
      target_audience_tags: landing.metadata?.target_audience_tags ?? [],
      created_at: landing.createdAt || new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (error) {
    stats.errors.push({ id, error: error.message });
    return;
  }

  // Rewrite the JSON file with clean URLs so the fallback path remains valid.
  const cleanLanding = {
    ...landing,
    assets: {
      bannerUrl: bannerFullUrl,
      bannerThumbUrl,
      backgroundUrl: backgroundFullUrl,
      backgroundThumbUrl,
    },
  };
  await writeFile(filePath, JSON.stringify(cleanLanding, null, 2));
  stats.migrated.push(id);
  console.log(`[${id}] migrated.`);
}

async function main() {
  await loadEnv();

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error(
      "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local."
    );
    process.exit(1);
  }

  const dir = join(process.cwd(), "data", "landings");
  if (!existsSync(dir)) {
    console.log("No data/landings/ directory found, nothing to migrate.");
    return;
  }

  const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  console.log(`Found ${files.length} landing files in ${dir}`);

  const stats: MigrationStats = { migrated: [], skipped: [], errors: [] };

  for (const file of files) {
    const filePath = join(dir, file);
    try {
      const content = await readFile(filePath, "utf-8");
      const landing = JSON.parse(content) as LegacyLanding;
      await migrateOne(filePath, landing, stats);
    } catch (error) {
      stats.errors.push({
        id: file,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.log("\n--- Migration summary ---");
  console.log(`Migrated: ${stats.migrated.length}`);
  for (const id of stats.migrated) console.log(`  + ${id}`);
  console.log(`Skipped:  ${stats.skipped.length}`);
  for (const id of stats.skipped) console.log(`  - ${id}`);
  console.log(`Errors:   ${stats.errors.length}`);
  for (const e of stats.errors) console.log(`  ! ${e.id}: ${e.error}`);
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
