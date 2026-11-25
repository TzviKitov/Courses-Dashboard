import { toMediaPath } from "@/lib/ui/media-path";

/**
 * Make a value safe to use as a plain `<img src>`.
 * Only http(s), blob:, data:image/* and site-relative paths are allowed; anything
 * else (javascript:, data:text/html, strings with markup characters) becomes "".
 */
export function safeImgSrc(src: string): string {
  src = toMediaPath(src);
  // Image URLs never contain HTML meta-characters or whitespace.
  if (/[<>"'`\s]/.test(src)) return "";
  let url: URL;
  try {
    url = new URL(src, "https://placeholder.invalid");
  } catch {
    return "";
  }
  const isImageData =
    url.protocol === "data:" && src.slice(0, 11).toLowerCase() === "data:image/";
  const allowed =
    url.protocol === "https:" ||
    url.protocol === "http:" ||
    url.protocol === "blob:" ||
    isImageData;
  if (!allowed) return "";
  // Relative paths were resolved against a dummy origin: keep only the path part.
  const candidate =
    url.origin === "https://placeholder.invalid"
      ? `${url.pathname}${url.search}${url.hash}`
      : url.href;
  // decode then encode: escapes anything unsafe without double-encoding.
  try {
    return encodeURI(decodeURI(candidate));
  } catch {
    return "";
  }
}
