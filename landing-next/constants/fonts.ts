// Hebrew fonts catalog for banner + landing creation.
// Unavailable commercial fonts use close substitutes; self-host can be wired later via selfHostPath.

export type FontSource = "google" | "system" | "self-hosted";
export type FontStatus = "available" | "substitute";
export type FontCategory = "sans-serif" | "serif" | "display" | "handwriting";

export interface HebrewFont {
  id: string;
  /** Display name shown to the user (requested brand name). */
  displayName: string;
  /** Hebrew short name in parentheses style. */
  labelHe: string;
  /** CSS / Google Fonts family used for preview & landing render today. */
  previewFamily: string;
  /** Alias for older call sites that used `name`. */
  name: string;
  label: string;
  category: FontCategory;
  weights: number[];
  source: FontSource;
  status: FontStatus;
  /** When true, UI/docs expect a future self-hosted file under selfHostPath. */
  selfHostReady: boolean;
  selfHostPath?: string;
  whenToChoose: string;
  /** Hint embedded in Gemini banner prompts. */
  geminiHint: string;
}

export const HEBREW_FONTS: HebrewFont[] = [
  {
    id: "arial",
    displayName: "Arial",
    labelHe: "אריאל",
    previewFamily: "Arial, Helvetica, sans-serif",
    name: "Arial",
    label: "Arial (אריאל)",
    category: "sans-serif",
    weights: [400, 700],
    source: "system",
    status: "available",
    selfHostReady: false,
    whenToChoose: "ברירת המחדל המוכרת והנגישה לכל משתמש.",
    geminiHint: "Arial / classic system sans-serif — highly accessible, familiar default",
  },
  {
    id: "heebo",
    displayName: "Heebo",
    labelHe: "היבו",
    previewFamily: "Heebo",
    name: "Heebo",
    label: "Heebo (היבו)",
    category: "sans-serif",
    weights: [400, 500, 700],
    source: "google",
    status: "available",
    selfHostReady: false,
    whenToChoose: "הבחירה המנצחת לכותרות ובאנרים.",
    geminiHint: "Heebo — excellent for Hebrew headlines and banners, modern geometric sans",
  },
  {
    id: "assistant",
    displayName: "Assistant",
    labelHe: "אסיסטנט",
    previewFamily: "Assistant",
    name: "Assistant",
    label: "Assistant (אסיסטנט)",
    category: "sans-serif",
    weights: [400, 500, 700],
    source: "google",
    status: "available",
    selfHostReady: false,
    whenToChoose: "הבחירה הנקייה והקריאה ביותר לטקסט רץ בדיגיטל.",
    geminiHint: "Assistant — clean, highly readable Hebrew body text for digital",
  },
  {
    id: "ploni",
    displayName: "Ploni",
    labelHe: "פלוני",
    previewFamily: "Heebo",
    name: "Heebo",
    label: "Ploni (פלוני)",
    category: "sans-serif",
    weights: [400, 500, 700],
    source: "self-hosted",
    status: "substitute",
    selfHostReady: true,
    selfHostPath: "/fonts/ploni/",
    whenToChoose: "פונט הפרימיום שמתאים לכל סוג עיצוב ומשדר מקצועיות גבוהה.",
    geminiHint:
      "Premium professional Hebrew sans (Ploni style) — polished, versatile, high-end feel; render like refined Heebo",
  },
  {
    id: "rubik",
    displayName: "Rubik",
    labelHe: "רוביק",
    previewFamily: "Rubik",
    name: "Rubik",
    label: "Rubik (רוביק)",
    category: "sans-serif",
    weights: [400, 500, 700],
    source: "google",
    status: "available",
    selfHostReady: false,
    whenToChoose: "למותגים שרוצים מראה מודרני אך ידידותי ורך.",
    geminiHint: "Rubik — modern yet friendly soft geometric sans",
  },
  {
    id: "alef",
    displayName: "Alef",
    labelHe: "אלף",
    previewFamily: "Alef",
    name: "Alef",
    label: "Alef (אלף)",
    category: "sans-serif",
    weights: [400, 700],
    source: "google",
    status: "available",
    selfHostReady: false,
    whenToChoose: "פונט מסך נוכח וברור מאוד.",
    geminiHint: "Alef — strong clear screen presence, very readable Hebrew",
  },
  {
    id: "frank-ruehl",
    displayName: "Frank Ruehl",
    labelHe: "פרנק ריהל",
    previewFamily: "Frank Ruhl Libre",
    name: "Frank Ruhl Libre",
    label: "Frank Ruehl (פרנק ריהל)",
    category: "serif",
    weights: [400, 500, 700],
    source: "google",
    status: "available",
    selfHostReady: false,
    whenToChoose: "למסרים שדורשים אלגנטיות, מסורת או מכובדות.",
    geminiHint: "Frank Ruehl / Frank Ruhl Libre — elegant traditional Hebrew serif, dignified",
  },
  {
    id: "david",
    displayName: "David",
    labelHe: "דוד",
    previewFamily: "David Libre",
    name: "David Libre",
    label: "David (דוד)",
    category: "serif",
    weights: [400, 500, 700],
    source: "google",
    status: "available",
    selfHostReady: false,
    whenToChoose: "בחירה קלאסית, נקייה ופשוטה לקריאה.",
    geminiHint: "David Libre — classic clean simple Hebrew serif for reading",
  },
  {
    id: "noto-sans-hebrew",
    displayName: "Noto Sans Hebrew",
    labelHe: "נוטו סנס",
    previewFamily: "Noto Sans Hebrew",
    name: "Noto Sans Hebrew",
    label: "Noto Sans Hebrew",
    category: "sans-serif",
    weights: [400, 500, 700],
    source: "google",
    status: "available",
    selfHostReady: false,
    whenToChoose: "פונט קלאסי של גוגל שתומך במגוון שפות ושומר על אסתטיקה רצינית.",
    geminiHint: "Noto Sans Hebrew — Google classic, multilingual, serious aesthetic",
  },
  {
    id: "open-sans-hebrew",
    displayName: "Open Sans Hebrew",
    labelHe: "אופן סנס",
    previewFamily: "Open Sans",
    name: "Open Sans",
    label: "Open Sans Hebrew",
    category: "sans-serif",
    weights: [400, 500, 700],
    source: "google",
    status: "available",
    selfHostReady: false,
    whenToChoose: "גופן גאומטרי ועגלגל שמתאים לממשקים ידידותיים.",
    geminiHint: "Open Sans — geometric rounded friendly UI sans (Hebrew-capable)",
  },
  {
    id: "tamlil",
    displayName: "Tamlil",
    labelHe: "תמליל",
    previewFamily: "Assistant",
    name: "Assistant",
    label: "Tamlil (תמליל)",
    category: "sans-serif",
    weights: [400, 500, 700],
    source: "self-hosted",
    status: "substitute",
    selfHostReady: true,
    selfHostPath: "/fonts/tamlil/",
    whenToChoose: "פונט פרקטי עם משקלים רבים שמאפשר גמישות עיצובית.",
    geminiHint:
      "Tamlil-style practical multi-weight Hebrew sans with design flexibility; render like clean Assistant",
  },
  {
    id: "kedim",
    displayName: "Kedim",
    labelHe: "קדים",
    previewFamily: "Frank Ruhl Libre",
    name: "Frank Ruhl Libre",
    label: "Kedim (קדים)",
    category: "serif",
    weights: [400, 500, 700],
    source: "self-hosted",
    status: "substitute",
    selfHostReady: true,
    selfHostPath: "/fonts/kedim/",
    whenToChoose: "פונט ייחודי שמשלב ניקיון מודרני עם ניחוח היסטורי להשארת חותם.",
    geminiHint:
      "Kedim-style unique Hebrew type combining modern cleanliness with historical character; serif presence like Frank Ruhl",
  },
  {
    id: "nectarina",
    displayName: "Nectarina",
    labelHe: "נקטרינה",
    previewFamily: "Varela Round",
    name: "Varela Round",
    label: "Nectarina (נקטרינה)",
    category: "display",
    weights: [400],
    source: "self-hosted",
    status: "substitute",
    selfHostReady: true,
    selfHostPath: "/fonts/nectarina/",
    whenToChoose: 'פונט "חמוד" מאוד, תומך בעברית ואנגלית וכולל ניקוד.',
    geminiHint:
      "Nectarina-style cute friendly Hebrew display font with nikud support; soft rounded like Varela Round",
  },
  {
    id: "ploni-yad",
    displayName: "Ploni-Yad",
    labelHe: "פלוני-יד",
    previewFamily: "Varela Round",
    name: "Varela Round",
    label: "Ploni-Yad (פלוני-יד)",
    category: "handwriting",
    weights: [400],
    source: "self-hosted",
    status: "substitute",
    selfHostReady: true,
    selfHostPath: "/fonts/ploni-yad/",
    whenToChoose: 'גרסת כתב היד של הפונט המקצועי "פלוני", משלב בין ניקיון לחמימות.',
    geminiHint:
      "Ploni-Yad handwriting style — clean yet warm handwritten Hebrew lettering, professional casual feel",
  },
];

export function getFontById(id: string): HebrewFont | undefined {
  return HEBREW_FONTS.find((font) => font.id === id);
}

export function getFontByName(name: string): HebrewFont | undefined {
  return HEBREW_FONTS.find(
    (font) =>
      font.name === name ||
      font.displayName === name ||
      font.previewFamily === name
  );
}

/** Resolve CSS font-family string for a catalog id (or legacy family name). */
export function resolveFontFamily(idOrName: string): string {
  const byId = getFontById(idOrName);
  if (byId) return byId.previewFamily;
  const byName = getFontByName(idOrName);
  if (byName) return byName.previewFamily;
  return idOrName || DEFAULT_FONT.previewFamily;
}

export function buildGoogleFontUrl(
  fontName: string,
  weights: number[] = [400, 500, 700]
): string {
  const font = getFontByName(fontName) || getFontById(fontName);
  if (font && font.source !== "google") {
    return "";
  }
  const family = font?.name || fontName;
  const actualWeights = font
    ? font.weights.filter((w) => weights.includes(w))
    : weights;
  const weightParam = (actualWeights.length ? actualWeights : weights).join(";");
  const familyParam = family.replace(/ /g, "+");
  return `https://fonts.googleapis.com/css2?family=${familyParam}:wght@${weightParam}&display=swap`;
}

/** Unique Google Fonts CSS URLs needed to preview the catalog. */
export function buildAllGoogleFontUrls(): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const font of HEBREW_FONTS) {
    if (font.source !== "google") continue;
    const url = buildGoogleFontUrl(font.name, font.weights);
    if (url && !seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }
  return urls;
}

export const DEFAULT_FONT = HEBREW_FONTS.find((f) => f.id === "heebo")!;
export const DEFAULT_FONT_ID = DEFAULT_FONT.id;
