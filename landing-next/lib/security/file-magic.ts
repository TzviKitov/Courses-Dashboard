const PDF = [0x25, 0x50, 0x44, 0x46]; // %PDF
const JPEG = [0xff, 0xd8, 0xff];
const PNG = [0x89, 0x50, 0x4e, 0x47];
const GIF87 = [0x47, 0x49, 0x46, 0x38, 0x37];
const GIF89 = [0x47, 0x49, 0x46, 0x38, 0x39];
const WEBP_RIFF = [0x52, 0x49, 0x46, 0x46];

function startsWith(bytes: Uint8Array, sig: number[]): boolean {
  if (bytes.length < sig.length) return false;
  return sig.every((b, i) => bytes[i] === b);
}

export type DetectedFileKind = "pdf" | "jpeg" | "png" | "gif" | "webp" | null;

export function detectFileKind(bytes: Uint8Array): DetectedFileKind {
  if (startsWith(bytes, PDF)) return "pdf";
  if (startsWith(bytes, JPEG)) return "jpeg";
  if (startsWith(bytes, PNG)) return "png";
  if (startsWith(bytes, GIF87) || startsWith(bytes, GIF89)) return "gif";
  if (
    startsWith(bytes, WEBP_RIFF) &&
    bytes.length >= 12 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "webp";
  }
  return null;
}

export function isAllowedRegistrationFile(bytes: Uint8Array, declaredMime: string): boolean {
  const kind = detectFileKind(bytes);
  if (kind === "pdf") return declaredMime === "application/pdf";
  if (kind === "jpeg") return declaredMime === "image/jpeg";
  if (kind === "png") return declaredMime === "image/png";
  return false;
}

export function isAllowedDesignImage(bytes: Uint8Array, declaredMime: string): boolean {
  const kind = detectFileKind(bytes);
  if (kind === "jpeg") return declaredMime === "image/jpeg";
  if (kind === "png") return declaredMime === "image/png";
  if (kind === "webp") return declaredMime === "image/webp";
  if (kind === "gif") return declaredMime === "image/gif";
  return false;
}

export function extensionForKind(kind: DetectedFileKind): string {
  switch (kind) {
    case "pdf":
      return "pdf";
    case "png":
      return "png";
    case "gif":
      return "gif";
    case "webp":
      return "webp";
    default:
      return "jpg";
  }
}
