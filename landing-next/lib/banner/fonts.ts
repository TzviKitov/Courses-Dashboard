import { BANNER_FONT_FILES } from "../fonts/banner-fonts";
import { DEFAULT_FONT, getFontById } from "../../constants/fonts";
import { FONT_FAMILY as HEEBO_FAMILY, loadCanvas } from "../logos/details-line";

/**
 * Which embedded font draws the headline for each font choice. The app already maps
 * the choices without a font file of their own to a close one (Ploni uses Heebo,
 * Tamlil uses Assistant, ...); this follows the same mapping via `previewFamily`.
 */
const FAMILY_KEY: Record<string, string> = {
  heebo: "heebo",
  assistant: "assistant",
  rubik: "rubik",
  alef: "alef",
  "frank ruhl libre": "frank-ruhl-libre",
  "david libre": "david-libre",
  "noto sans hebrew": "noto-sans-hebrew",
  "open sans": "open-sans",
  "varela round": "varela-round",
};

/** Key of the embedded font for a font choice (Heebo when unknown). */
export function bannerFontKey(fontId?: string): string {
  const font = (fontId && getFontById(fontId)) || DEFAULT_FONT;
  const family = font.previewFamily.toLowerCase();
  if (family.startsWith("arial")) return "arimo"; // Arimo is metric-compatible with Arial
  return FAMILY_KEY[family] ?? "heebo";
}

export interface BannerFontSpec {
  /** CSS font stack: Hebrew subset, Latin subset (digits, English), Heebo as a last resort. */
  stack: string;
  weight: number;
}

const registered = new Set<string>();

/** Registers the font once and returns what to put in `ctx.font`. Heebo when anything fails. */
export async function ensureBannerFont(fontId?: string): Promise<BannerFontSpec> {
  const key = bannerFontKey(fontId);
  const fallback: BannerFontSpec = { stack: HEEBO_FAMILY, weight: 700 };
  if (key === "heebo") return fallback;
  const files = BANNER_FONT_FILES[key];
  const canvas = await loadCanvas();
  if (!files || !canvas) return fallback;
  const he = `AvuBanner_${key}_he`;
  const la = `AvuBanner_${key}_la`;
  if (!registered.has(key)) {
    try {
      const okHe = canvas.GlobalFonts.register(Buffer.from(files.hebrew, "base64"), he);
      const okLa = canvas.GlobalFonts.register(Buffer.from(files.latin, "base64"), la);
      if (!okHe || !okLa) return fallback;
      registered.add(key);
    } catch {
      return fallback;
    }
  }
  return { stack: `"${he}", "${la}", ${HEEBO_FAMILY}`, weight: files.weight };
}
