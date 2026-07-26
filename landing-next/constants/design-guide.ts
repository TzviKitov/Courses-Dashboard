/** Style-guide catalogs for banner / landing creation (sent to Gemini behind the scenes). */

export type VisualStyleId =
  | "realistic"
  | "animation"
  | "clay_3d"
  | "natural_soft"
  | "abstract_pastel"
  | "futuristic"
  | "corporate_formal";

export type CompositionId = "pyramid" | "hero_center" | "modular_grid";

export type PaletteId =
  | "tech_innovation"
  | "luxury_premium"
  | "health_environment"
  | "creativity_emotion"
  | "food_urgency"
  | "nature_earth"
  | "gen_z_neon"
  | "lifestyle_pastel"
  | "corporate_government"
  | "google_friendly"
  | "crypto_neon"
  | "maximalist_contrast"
  | "biophilic_earth"
  | "cyber_premium"
  | "sophisticated_retro";

export type BackgroundPromptMode = "free_text" | "surprise" | "inspiration";
export type ColorMode = "surprise" | "manual" | "preset";
export type FlyerSource = "upload" | "generate";
export type BackgroundMode = "same_as_flyer" | "generate";

export interface VisualStyleOption {
  id: VisualStyleId;
  label: string;
  geminiHint: string;
}

export interface CompositionOption {
  id: CompositionId;
  label: string;
  whenToChoose: string;
  accessibility: string;
  aiDescription: string;
}

export interface PaletteOption {
  id: PaletteId;
  label: string;
  whenToChoose: string;
  description: string;
  colors: [string, string, string, string];
  colorLabels?: [string, string, string, string];
}

/** All three compositions contradict each other — UI enforces single select. */
export const COMPOSITION_CONFLICTS: Record<CompositionId, CompositionId[]> = {
  pyramid: ["hero_center", "modular_grid"],
  hero_center: ["pyramid", "modular_grid"],
  modular_grid: ["pyramid", "hero_center"],
};

export const VISUAL_STYLES: VisualStyleOption[] = [
  {
    id: "realistic",
    label: "ריאליסטי",
    geminiHint:
      "Photorealistic photography, 4K resolution, cinematic lighting, depth of field, professional quality",
  },
  {
    id: "animation",
    label: "אנימציה (מצוייר)",
    geminiHint:
      "Illustrated animation style, clean cartoon/drawn look, expressive shapes, polished digital illustration",
  },
  {
    id: "clay_3d",
    label: "חימר (3D)",
    geminiHint:
      "3D clay render aesthetic, soft rounded forms, gentle studio shadows, tactile material feel",
  },
  {
    id: "natural_soft",
    label: "סגנון טבעי ועדין",
    geminiHint:
      "Natural and delicate style, soft organic textures, gentle light, calm understated atmosphere",
  },
  {
    id: "abstract_pastel",
    label: "מופשט עם צבעי פסטל רכים",
    geminiHint:
      "Abstract composition with soft pastel colors, airy shapes, gentle gradients, dreamy minimal forms",
  },
  {
    id: "futuristic",
    label: "סגנון חדשני ועתידני",
    geminiHint:
      "Innovative futuristic style, sleek tech surfaces, subtle neon accents, forward-looking digital aesthetic",
  },
  {
    id: "corporate_formal",
    label: "סגנון ארגוני רשמי",
    geminiHint:
      "Formal corporate style, clean professional layout, trustworthy institutional visual language",
  },
];

export const COMPOSITIONS: CompositionOption[] = [
  {
    id: "pyramid",
    label: "פירמידה",
    whenToChoose: "אירועים/גיוס פשוט עם תאריכים שעות ומקום",
    accessibility: "כותרות היררכיות",
    aiDescription: "סדר מלמעלה למטה פרטים שעות וכו'",
  },
  {
    id: "hero_center",
    label: "גיבור באמצע",
    whenToChoose: "סיפורים רגשיים — כותרת אחת מרכזית בלבד",
    accessibility: "alt-text על תמונה מרכזית",
    aiDescription: "רגש ראשון, פרטים אחר כך",
  },
  {
    id: "modular_grid",
    label: "גריד מודולרי",
    whenToChoose: "מגוון מידע/שירותים — קוביות תוכן",
    accessibility: "בלוקים נפרדים ל-screen reader",
    aiDescription: "מידע מאורגן בקוביות",
  },
];

export const COLOR_PALETTES: PaletteOption[] = [
  {
    id: "tech_innovation",
    label: "טכנולוגיה וחדשנות",
    whenToChoose: "כחול וטורקיז",
    description: "משדרת אמינות, קדמה ויציבות.",
    colors: ["#007BFF", "#17A2B8", "#E3F2FD", "#212529"],
  },
  {
    id: "luxury_premium",
    label: "יוקרה ופרימיום",
    whenToChoose: "שחור וזהב",
    description: "מייצרת תחושת סמכות, אלגנטיות וכוח.",
    colors: ["#000000", "#D4AF37", "#FFFFFF", "#495057"],
  },
  {
    id: "health_environment",
    label: "בריאות וסביבה",
    whenToChoose: "ירוק ונייבי",
    description: "איזון בין רעננות וצמיחה לבין בגרות ומקצועיות.",
    colors: ["#28A745", "#001F3F", "#F1F8E9", "#FFFFFF"],
  },
  {
    id: "creativity_emotion",
    label: "יצירתיות ורגש",
    whenToChoose: "סגול וורוד",
    description: "פונה לקהל צעיר, נשי או אמנותי עם אנרגיה גבוהה.",
    colors: ["#6F42C1", "#E83E8C", "#F3E5F5", "#212121"],
  },
  {
    id: "food_urgency",
    label: "מזון ודחיפות",
    whenToChoose: "אדום וצהוב",
    description: "מעוררת תיאבון ומניעה לפעולה מיידית.",
    colors: ["#DC3545", "#FFC107", "#FFFFFF", "#343A40"],
  },
  {
    id: "nature_earth",
    label: "חיבור לטבע",
    whenToChoose: "גווני אדמה",
    description: 'נגישות, ביתיות ותחושת "ביו-עיצוב" מודרנית.',
    colors: ["#556B2F", "#8B4513", "#D2B48C", "#F5F5DC"],
  },
  {
    id: "gen_z_neon",
    label: "דור ה-Z ודינמיות",
    whenToChoose: "ניאון",
    description: "צבעים עזים, זוהרים ומלאי קונטרסט למשיכת תשומת לב.",
    colors: ["#39FF14", "#FF00FF", "#00FFFF", "#000000"],
  },
  {
    id: "lifestyle_pastel",
    label: "לייף-סטייל ונינוחות",
    whenToChoose: "פסטלים",
    description: "משדרת עדינות, שלווה ופתיחות.",
    colors: ["#B2EBF2", "#F8BBD0", "#FFF9C4", "#424242"],
  },
  {
    id: "corporate_government",
    label: "תאגידי וממשלתי",
    whenToChoose: "נייבי ואפור",
    description: "מייצב אמון, סדר ואחריות.",
    colors: ["#1A237E", "#9E9E9E", "#F5F5F5", "#000000"],
  },
  {
    id: "google_friendly",
    label: 'ידידותיות ורב-גוניות (פלטת "גוגל")',
    whenToChoose: "פלטת גוגל",
    description: "פשטות, פתיחות וחוויית משתמש ישרה.",
    colors: ["#4285F4", "#EA4335", "#FBBC05", "#34A853"],
  },
  {
    id: "crypto_neon",
    label: "צבעי ניאון סגנון קריפטו/ווב",
    whenToChoose: "קריפטו / ווב",
    description: "כחול חשמלי, ורוד ניאון, ירוק לייזר ושחור מט.",
    colors: ["#00E5FF", "#FF00FF", "#39FF14", "#121212"],
    colorLabels: ["כחול חשמלי", "ורוד ניאון", "ירוק לייזר", "שחור מט"],
  },
  {
    id: "maximalist_contrast",
    label: "מקסימליזם אנרגטי",
    whenToChoose: "More-is-more / אירועים צעירים",
    description:
      "ניגודיות חזקה והתנגשויות צבע תוססות לתפיסת העין בשבריר שנייה. אידיאלית לפלאיירים של אירועים צעירים ורועשים.",
    colors: ["#F0FF00", "#FF5F1F", "#003366", "#FFFFFF"],
    colorLabels: ["צהוב חשמלי", "כתום להבה", "נייבי עמוק", "לבן טהור"],
  },
  {
    id: "biophilic_earth",
    label: "ביו-עיצוב ואדמה",
    whenToChoose: "Biophilic Design",
    description:
      "מחברת בין טבע לטכנולוגיה עם טקסטורות של חול, אבן וצמחייה לתחושת נגישות וביתיות מודרנית.",
    colors: ["#556B2F", "#E2725B", "#D1BE9D", "#4A3728"],
    colorLabels: ["ירוק זית", "טרקוטה", "בז׳ אבן", "חום קליפה"],
  },
  {
    id: "cyber_premium",
    label: "Cyber-Premium (יוקרה מטאלית)",
    whenToChoose: "יוקרה מטאלית / עתידנית",
    description:
      "טיטניום וכרום עם גווני חצות — גרדיאנטים מורכבים ותחושת מתכת עתידנית.",
    colors: ["#878681", "#C0C0C0", "#191970", "#D4AF37"],
    colorLabels: ["אפור טיטניום", "כסף כרום", "כחול חצות", "זהב עדין"],
  },
  {
    id: "sophisticated_retro",
    label: "רטרו-מודרני",
    whenToChoose: "נוסטלגיה עם טוויסט עכשווי",
    description:
      "גווני קרמל, ניוד וכתומים רכים לצד סגול עמוק — פתיחות רגשית וחמימות.",
    colors: ["#AF6E4D", "#F2D2BD", "#FF8C00", "#301934"],
    colorLabels: ["קרמל", "ניוד", "כתום רך", "סגול עמוק"],
  },
];

export function getVisualStyle(id: string): VisualStyleOption | undefined {
  return VISUAL_STYLES.find((s) => s.id === id);
}

export function getComposition(id: string): CompositionOption | undefined {
  return COMPOSITIONS.find((c) => c.id === id);
}

export function getPalette(id: string): PaletteOption | undefined {
  return COLOR_PALETTES.find((p) => p.id === id);
}

/** Merge selected visual styles into a Gemini prompt fragment. */
export function buildVisualStylesPrompt(ids: string[]): string {
  if (!ids.length) {
    return VISUAL_STYLES[0].geminiHint;
  }
  return ids
    .map((id) => getVisualStyle(id)?.geminiHint)
    .filter(Boolean)
    .join("; ");
}

export function buildCompositionPrompt(ids: string[]): string {
  const id = ids[0] || "pyramid";
  const c = getComposition(id) || COMPOSITIONS[0];
  return `Composition "${c.label}": ${c.aiDescription}. Accessibility note: ${c.accessibility}. Use when: ${c.whenToChoose}.`;
}

export function buildColorPrompt(options: {
  colorMode: ColorMode;
  paletteIds?: string[];
  manualColors?: string[];
}): string {
  const { colorMode, paletteIds, manualColors } = options;
  if (colorMode === "manual" && manualColors?.length) {
    return `Exact color palette (use these hex codes): ${manualColors.join(", ")}`;
  }
  if (colorMode === "preset" && paletteIds?.[0]) {
    const p = getPalette(paletteIds[0]);
    if (p) {
      return `Color palette "${p.label}": ${p.description} Hex codes: ${p.colors.join(", ")}`;
    }
  }
  return "Surprise me with a cohesive, distinctive professional color palette that fits the course theme; bold but tasteful, high contrast for Hebrew text legibility";
}

export function toggleVisualStyle(
  current: string[],
  id: VisualStyleId
): string[] {
  if (current.includes(id)) {
    return current.filter((x) => x !== id);
  }
  return [...current, id];
}

/** Compositions currently conflict — selecting one replaces the previous. */
export function selectComposition(
  _current: string[],
  id: CompositionId
): string[] {
  return [id];
}
