/**
 * Public Supabase Storage files are served from our own address under /media/
 * (see the rewrite in next.config.ts), so a visitor's browser and any URL filter
 * on the way only ever see this site, never a third-party storage host.
 */
const STORAGE_PREFIX = "/storage/v1/object/public/";

export function toMediaPath(src: string): string {
  if (!src || !src.startsWith("https://")) return src;
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return src;
  }
  if (!url.hostname.endsWith(".supabase.co")) return src;
  if (!url.pathname.startsWith(STORAGE_PREFIX)) return src;
  return `/media/${url.pathname.slice(STORAGE_PREFIX.length)}${url.search}`;
}
