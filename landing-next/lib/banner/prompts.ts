import {
  buildColorPrompt,
  buildVisualStylesPrompt,
} from "../../constants/design-guide";
import { getFontById, DEFAULT_FONT } from "../../constants/fonts";
import type { DesignPreferences as GuideDesignPreferences } from "../../types/course";
import { reservedZonesPrompt } from "../logos/reserved-bands";

/** The course fields the banner prompts use. */
export interface BannerCourse {
  title_he: string;
  subtitle_he: string;
}

export interface ArtDirection {
  visualStyles: string;
  /** Composition directive for the banner (mentions the headline). */
  composition: string;
  /** Composition directive for the text-free background. */
  backgroundComposition: string;
  colors: string;
  fontHint: string;
  backgroundSubject: string;
}

/**
 * The hints in constants/fonts.ts read "Name - description". Only the description
 * is sent: when the font name was in the prompt the model printed it into the image
 * ("Heebo" on a sports shirt).
 */
const FONT_NAMES = [
  "Frank Ruhl Libre",
  "Frank Ruehl",
  "Frank Ruhl",
  "Varela Round",
  "Nectarina",
  "Ploni-Yad",
  "Kedim",
  "Noto Sans Hebrew",
  "David Libre",
  "Open Sans",
  "Heebo",
  "Assistant",
  "Rubik",
  "Alef",
  "Ploni",
  "Tamlil",
  "Arial",
];

export function fontDescription(hint: string): string {
  const parts = hint.split(" — ");
  let description = parts.length > 1 ? parts.slice(1).join(" — ") : hint;
  description = description.replace(/;\s*render like[^;]*/gi, "");
  for (const name of FONT_NAMES) {
    // "Tamlil-style", "Ploni style" and the bare name all go.
    description = description.replace(new RegExp(`${name}(?:[- ]style)?\\s*`, "gi"), "");
  }
  description = description.replace(/\(\s*\)/g, "").replace(/\s{2,}/g, " ").trim();
  return description || "clean modern Hebrew sans-serif";
}

/**
 * Short composition directives for the image model. The guide texts shown in the
 * create form (when to choose, accessibility notes) are UI help, not instructions,
 * and are not sent to the model.
 */
const BANNER_COMPOSITION: Record<string, string> = {
  pyramid:
    "the headline and subtitle in the upper part of the frame, clearly below the top edge and clearly above the people's heads, and the main subject or scene filling the lower part",
  hero_center:
    "one central focal subject, with the headline close to it in a clear area, so the emotion comes first and the text supports it",
  modular_grid:
    "content organized in clean, separate blocks of similar visual weight, with the headline in its own calm block",
};

const BACKGROUND_COMPOSITION: Record<string, string> = {
  pyramid: "a calm, uncluttered upper area and the main subject in the lower part",
  hero_center: "one central focal subject with calm space around it",
  modular_grid: "clean, separate zones with calm areas between them",
};

export function buildArtDirection(design?: GuideDesignPreferences): ArtDirection {
  const visualStyles = buildVisualStylesPrompt(design?.visual_styles || ["realistic"]);
  const compositionId = design?.compositions?.[0] || "pyramid";
  const composition = BANNER_COMPOSITION[compositionId] ?? BANNER_COMPOSITION.pyramid;
  const backgroundComposition =
    BACKGROUND_COMPOSITION[compositionId] ?? BACKGROUND_COMPOSITION.pyramid;
  const colors = buildColorPrompt({
    colorMode: design?.color_mode || "surprise",
    paletteIds: design?.palette_ids,
    manualColors: design?.manual_colors,
  });
  const font = getFontById(design?.fonts?.banner_font_id || DEFAULT_FONT.id) || DEFAULT_FONT;
  const bg = design?.background_prompt;
  let backgroundSubject = "Surprise me with a distinctive, on-theme visual concept for the course.";
  if (bg?.mode === "free_text" && bg.text?.trim()) {
    backgroundSubject = bg.text.trim();
  } else if (bg?.mode === "inspiration") {
    backgroundSubject =
      "Match the style, mood, lighting and colors of the attached reference image. Do not copy anything written on it.";
  }

  return {
    visualStyles,
    composition,
    backgroundComposition,
    colors,
    fontHint: fontDescription(font.geminiHint),
    backgroundSubject,
  };
}

/** Prompt for the landing-page hero background (no writing in the image). */
export function buildBackgroundPrompt(
  course: BannerCourse,
  art: ArtDirection,
  brandColorDesc: string
): string {
  return `Create a 16:9 professional background image for a course landing page.

GOAL: Hero background for a course about "${course.title_he}". The image contains no writing of any kind.

BACKGROUND CONCEPT: ${art.backgroundSubject}

SUBJECT: Visual elements that represent the course theme. Text is overlaid on top of this image later.

CONTEXT: Youth and young adults, professional education, trustworthy brand tone.

LAYOUT / COMPOSITION: ${art.backgroundComposition}
- Calm, uncluttered areas for the text overlay; interesting but not busy; subtle, elegant details

STYLE:
- Visual: ${art.visualStyles}
- Color mood: ${art.colors}. The colors appear naturally in the scene, never as swatches, bars or strips
${brandColorDesc ? `- Brand overrides: ${brandColorDesc}` : ""}

RULES:
- No letters, numbers, words, logos or watermarks in any language. Signs, screens, boards, posters, books and papers are blank or show abstract shapes only
- A reference image, if attached, sets only mood, colors and style: never copy anything written on it
- Professional, polished look

OUTPUT: One high-quality 16:9 image, no writing.`;
}

/** Prompt for the banner/flyer image (headline and subtitle in Hebrew; logos and details are drawn in code). */
export function buildBannerPrompt(opts: {
  course: BannerCourse;
  art: ArtDirection;
  brandColorDesc: string;
  logoCount: number;
  detailsByCode: boolean;
  detailsText: string;
}): string {
  const { course, art, brandColorDesc, logoCount, detailsByCode, detailsText } = opts;
  const zonesLine = reservedZonesPrompt(logoCount, detailsByCode && Boolean(detailsText));

  const hasSubtitle = Boolean(
    course.subtitle_he && course.subtitle_he !== course.title_he
  );
  const hasDetails = !detailsByCode && Boolean(detailsText);
  const textItemCount = 1 + (hasSubtitle ? 1 : 0) + (hasDetails ? 1 : 0);
  // Sizes are described in a sentence, not as labels next to the strings: the model
  // printed a label word ("SUBTITLE") into the image once.
  const textSizes = hasSubtitle
    ? `The first line is the largest. The second line is about half its size and sits directly below it.${hasDetails ? " The last line is small and sits at the bottom." : ""}`
    : `The first line is the largest.${hasDetails ? " The last line is small and sits at the bottom." : ""}`;

  return `Create a professional marketing banner image for a course or group for youth and young adults.

=== ART DIRECTION ===
Visual Style: ${art.visualStyles}
Composition: ${art.composition}
Color mood: ${art.colors}. The colors appear naturally in the scene (light, clothing, props) and in the text, never as swatches, bars or strips
${brandColorDesc ? `Brand overrides: ${brandColorDesc}` : ""}
Background / scene concept: ${art.backgroundSubject}

=== HEBREW TEXT ===
Write exactly ${textItemCount} line${textItemCount > 1 ? "s" : ""} of Hebrew text on the banner, each one once, copied letter by letter as written, and nothing else anywhere in the image:
"${course.title_he}"
${hasSubtitle ? `"${course.subtitle_he}"
` : ""}${detailsByCode ? "" : detailsText ? `"${detailsText}"
` : ""}${textSizes}${detailsByCode ? " Do NOT write dates, times, location, or number of sessions anywhere: the course details line is added afterwards." : ""}

=== TYPOGRAPHY ===
- Hebrew font direction: ${art.fontHint}
- Hebrew, right-to-left. Keep digits, hyphens and parentheses exactly in the given order
- Crisp, sharp, perfectly spelled letters with high contrast against the background

=== LAYOUT ===
- Plan the scene around the text: respect the composition rule and keep the text in calm, empty areas with breathing room, never over busy detail. If the text needs more contrast, soften or darken the scene there with a smooth gradient or shadow, never with a solid panel or box behind the text
- Every face and head stays fully visible, uncovered and inside the frame. Text goes beside or above the people, never on them
- No logos, emblems, partner marks, watermarks or labeled boxes, and never the words "logo" or "לוגו"
${zonesLine ? `- ${zonesLine}
` : ""}
OUTPUT: One high-quality 16:9 banner image.`;
}
