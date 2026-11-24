import {
  buildColorPrompt,
  buildVisualStylesPrompt,
} from "../../constants/design-guide";
import type { DesignPreferences as GuideDesignPreferences } from "../../types/course";
import { reservedZonesPrompt } from "../logos/reserved-bands";

/**
 * Prompts for the two images of a course. Both ask for a picture with no writing at
 * all: the headline, the details line and the partner logos are drawn in code
 * (lib/banner/headline.ts, lib/logos), because the image model garbles Hebrew,
 * repeats the headline and puts text over people.
 *
 * The guide texts shown in the create form (when to choose, accessibility notes)
 * are UI help and are not sent to the model. Prompt wording was tuned with
 * scripts/banner-lab.ts; two things to know before editing:
 * - digits, "%" and capitalised labels in the prompt get drawn into the image;
 * - a font name in the prompt gets printed on clothes.
 */

/** The course fields the prompts use. */
export interface BannerCourse {
  title_he: string;
  subtitle_he: string;
}

export interface ArtDirection {
  visualStyles: string;
  /** Where the main subject goes and where calm space is left for the text. */
  composition: string;
  colors: string;
  backgroundSubject: string;
}

const COMPOSITION: Record<string, string> = {
  pyramid: "the main subject in the lower two thirds of the frame, and the upper third left as calm, uncluttered space (sky, wall or blurred surroundings) with no people in it",
  hero_center: "one central focal subject, with a large calm, uncluttered space above or beside it and no people in that space",
  modular_grid: "clean, separate blocks of similar visual weight, with one calm block",
};

export function buildArtDirection(design?: GuideDesignPreferences): ArtDirection {
  const compositionId = design?.compositions?.[0] || "pyramid";
  const bg = design?.background_prompt;
  let backgroundSubject = "Surprise me with a distinctive, on-theme visual concept for the course.";
  if (bg?.mode === "free_text" && bg.text?.trim()) {
    backgroundSubject = bg.text.trim();
  } else if (bg?.mode === "inspiration") {
    backgroundSubject =
      "Match the style, mood, lighting and colors of the attached reference image. Do not copy anything written on it.";
  }
  return {
    visualStyles: buildVisualStylesPrompt(design?.visual_styles || ["realistic"]),
    composition: COMPOSITION[compositionId] ?? COMPOSITION.pyramid,
    colors: buildColorPrompt({
      colorMode: design?.color_mode || "surprise",
      paletteIds: design?.palette_ids,
      manualColors: design?.manual_colors,
    }),
    backgroundSubject,
  };
}

/** Prompt for the landing-page hero background. */
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

LAYOUT / COMPOSITION: ${art.composition}
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

/** Prompt for the banner scene: the headline, details line and logos are added in code. */
export function buildBannerScenePrompt(opts: {
  course: BannerCourse;
  art: ArtDirection;
  brandColorDesc: string;
  logoCount: number;
  hasDetailsLine: boolean;
}): string {
  const { course, art, brandColorDesc, logoCount, hasDetailsLine } = opts;
  const zonesLine = reservedZonesPrompt(logoCount, hasDetailsLine);
  return `Create a professional 16:9 marketing image for a course or group for youth and young adults, about "${course.title_he}".

Concept: ${art.backgroundSubject}
Composition: ${art.composition}
Style: ${art.visualStyles}
Color mood: ${art.colors}. The colors appear naturally in the scene, never as swatches, bars or strips
${brandColorDesc ? `Brand overrides: ${brandColorDesc}` : ""}

Rules:
- The image contains no writing of any kind: no letters, numbers, logos or watermarks, and nothing written on clothing, signs, screens, posters or books
- Every face and head stays fully visible and inside the frame
${zonesLine ? `- ${zonesLine}
` : ""}
Output: one high-quality 16:9 image.`;
}
