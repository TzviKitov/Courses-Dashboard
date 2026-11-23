export type DownloadKind = "banner" | "background";

export interface DownloadableAssets {
  bannerFullUrl?: string | null;
  backgroundFullUrl?: string | null;
}

export function parseDownloadKind(value: unknown): DownloadKind | null {
  return value === "banner" || value === "background" ? value : null;
}

export function pickAssetUrl(
  assets: DownloadableAssets | null | undefined,
  kind: DownloadKind
): string | null {
  const url = kind === "banner" ? assets?.bannerFullUrl : assets?.backgroundFullUrl;
  return url || null;
}

/**
 * The download route fetches the URL server-side, so only our own public
 * Storage objects are allowed (no other hosts, no http, no other paths).
 */
export function isAllowedAssetUrl(
  url: string,
  supabaseUrl: string | undefined
): boolean {
  if (!supabaseUrl) return false;
  try {
    const asset = new URL(url);
    const base = new URL(supabaseUrl);
    return (
      asset.protocol === "https:" &&
      asset.host === base.host &&
      asset.pathname.startsWith("/storage/v1/object/public/")
    );
  } catch {
    return false;
  }
}

const OBJECT_PATH = /^(?:tmp|courses)\/[A-Za-z0-9_-]{1,64}\/[A-Za-z0-9._-]{1,128}$/;

/**
 * The object path inside our public Storage bucket, or null when the URL is not
 * one of ours. The server rebuilds the fetch URL from this validated path, so
 * a caller can never steer the request to another host or path.
 */
export function storageObjectPath(
  url: string,
  supabaseUrl: string | undefined,
  bucket: string
): string | null {
  if (!isAllowedAssetUrl(url, supabaseUrl)) return null;
  const prefix = `/storage/v1/object/public/${bucket}/`;
  const pathname = new URL(url).pathname;
  if (!pathname.startsWith(prefix)) return null;
  const path = pathname.slice(prefix.length);
  return OBJECT_PATH.test(path) ? path : null;
}

export function buildAssetUrl(
  supabaseUrl: string,
  bucket: string,
  path: string
): string {
  return `${new URL(supabaseUrl).origin}/storage/v1/object/public/${bucket}/${path}`;
}

const KIND_LABEL: Record<DownloadKind, string> = {
  banner: "banner",
  background: "background",
};

/** Human friendly file name: course title + kind, safe for every OS. */
export function downloadFileName(
  title: string | undefined,
  kind: DownloadKind,
  ext = "png"
): string {
  const cleaned = (title ?? "")
    .normalize("NFC")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
  return `${cleaned ? `${cleaned}-` : ""}${KIND_LABEL[kind]}.${ext}`;
}

/** Content-Disposition with an ASCII fallback and the real (Hebrew) name. */
export function contentDisposition(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "").replace(/["\\]/g, "") || "download.png";
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
