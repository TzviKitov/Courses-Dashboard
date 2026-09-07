import { readFile } from "fs/promises";
import { join } from "path";
import { getSupabaseAdmin, isSupabaseDbEnabled } from "@/lib/supabase/server";
import { uploadLogoImage } from "@/lib/supabase/storage";
import type { BrandLogoRow } from "@/lib/supabase/types";
import type { Logo } from "@/types/course";

export type BrandLogoRecord = Pick<
  BrandLogoRow,
  "id" | "name" | "url" | "storage_path" | "tags" | "sort_order"
>;

export type AdminLogosSource = "db" | "static";

export interface AdminLogosList {
  items: BrandLogoRecord[];
  source: AdminLogosSource;
  tableMissing: boolean;
}

function isMissingBrandLogosTable(
  error: { code?: string; message?: string } | null
): boolean {
  if (!error) return false;
  const msg = (error.message || "").toLowerCase();
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    (msg.includes("brand_logos") &&
      (msg.includes("does not exist") ||
        msg.includes("schema cache") ||
        msg.includes("could not find")))
  );
}

function toPickerLogo(row: { id: string; name: string; url: string; tags?: string[] | null }): Logo {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    tags: row.tags ?? [],
  };
}

async function readStaticLogos(): Promise<Logo[]> {
  const logosPath = join(process.cwd(), "public", "brand", "logos.json");
  const raw = await readFile(logosPath, "utf-8");
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (item): item is Logo =>
      Boolean(
        item &&
          typeof item === "object" &&
          typeof (item as Logo).id === "string" &&
          typeof (item as Logo).name === "string" &&
          typeof (item as Logo).url === "string"
      )
  );
}

function staticAsRecords(logos: Logo[]): BrandLogoRecord[] {
  return logos.map((logo, index) => ({
    id: logo.id,
    name: logo.name,
    url: logo.url,
    storage_path: null,
    tags: logo.tags ?? [],
    sort_order: (index + 1) * 10,
  }));
}

/** Logos shown to course creators in the picker. */
export async function listLogosForPicker(): Promise<Logo[]> {
  if (!isSupabaseDbEnabled()) {
    return readStaticLogos();
  }

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("brand_logos")
      .select("id, name, url, tags")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      if (isMissingBrandLogosTable(error)) {
        return readStaticLogos();
      }
      console.error("Failed to list brand_logos:", error);
      return readStaticLogos();
    }

    return (data ?? []).map(toPickerLogo);
  } catch (error) {
    console.error("listLogosForPicker:", error);
    return readStaticLogos();
  }
}

/** Full catalog for the admin management UI. */
export async function listBrandLogosAdmin(): Promise<AdminLogosList> {
  if (!isSupabaseDbEnabled()) {
    return {
      items: staticAsRecords(await readStaticLogos()),
      source: "static",
      tableMissing: false,
    };
  }

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("brand_logos")
      .select("id, name, url, storage_path, tags, sort_order")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      if (isMissingBrandLogosTable(error)) {
        return {
          items: staticAsRecords(await readStaticLogos()),
          source: "static",
          tableMissing: true,
        };
      }
      throw new Error(error.message);
    }

    return {
      items: (data ?? []) as BrandLogoRecord[],
      source: "db",
      tableMissing: false,
    };
  } catch (error) {
    if (error instanceof Error && isMissingBrandLogosTable({ message: error.message })) {
      return {
        items: staticAsRecords(await readStaticLogos()),
        source: "static",
        tableMissing: true,
      };
    }
    throw error;
  }
}

export function parseLogoTags(raw: string): string[] {
  return raw
    .split(/[,،]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 8);
}

export function slugifyLogoId(name: string): string {
  const ascii = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  if (ascii.length >= 2) return ascii;
  return `logo-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

async function uniqueLogoId(name: string): Promise<string> {
  const base = slugifyLogoId(name);
  const admin = getSupabaseAdmin();
  let candidate = base;
  let n = 2;
  for (let i = 0; i < 20; i += 1) {
    const { data, error } = await admin
      .from("brand_logos")
      .select("id")
      .eq("id", candidate)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return candidate;
    candidate = `${base}-${n}`;
    n += 1;
  }
  return `${base}-${Date.now().toString(36)}`;
}

async function nextSortOrder(): Promise<number> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("brand_logos")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.sort_order ?? 0) + 10;
}

export async function createBrandLogo(input: {
  name: string;
  tags: string[];
  bytes: Uint8Array;
}): Promise<BrandLogoRecord> {
  const admin = getSupabaseAdmin();
  const id = await uniqueLogoId(input.name);
  const uploaded = await uploadLogoImage(id, input.bytes);
  const sortOrder = await nextSortOrder();

  const row = {
    id,
    name: input.name,
    url: uploaded.url,
    storage_path: uploaded.path,
    tags: input.tags,
    sort_order: sortOrder,
  };

  const { data, error } = await admin
    .from("brand_logos")
    .insert(row)
    .select("id, name, url, storage_path, tags, sort_order")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as BrandLogoRecord;
}

export async function deleteBrandLogo(id: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("brand_logos").delete().eq("id", id);
  if (error) {
    if (isMissingBrandLogosTable(error)) {
      throw new Error("MISSING_TABLE");
    }
    throw new Error(error.message);
  }
}
