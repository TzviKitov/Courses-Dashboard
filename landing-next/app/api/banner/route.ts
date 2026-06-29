export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel Hobby allows up to 60s per function invocation. Banner generation
// can take 30-50s; setting an explicit cap avoids surprise truncations.
// Bump to 300 (5 min) if you upgrade to Pro and remove the SSE retries.
export const maxDuration = 60;

import { GoogleGenAI } from "@google/genai";
import { Vibrant } from "node-vibrant/node";
import { logUsageEvent } from "@/lib/admin/log-usage";
import { uploadImageVariants } from "@/lib/supabase/storage";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/ssr";
import { getServerBaseUrlFromRequest } from "@/lib/server-base-url";

const MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image-preview";

interface CourseData {
  title_he: string;
  subtitle_he: string;
  duration?: string;
  schedule?: {
    dates: string;
    days: string;
    time: string;
  };
  location?: string;
}

interface Logo {
  id: string;
  name: string;
  url: string;
}

interface BrandingColors {
  primary?: string;
  accent?: string;
}

interface DesignPreferences {
  aesthetic_style?: string;
  color_palette?: string;
  lighting_and_atmosphere?: string;
  // Art direction fields
  visual_style?: string;
  composition_rule?: string;
  lighting_mood?: string;
  color_mood?: string;
}

interface BannerRequest {
  course: CourseData;
  design?: DesignPreferences;
  branding?: {
    logos?: Logo[];
    colors?: BrandingColors;
  };
}

// Logo placement configuration for the prompt (up to 4 logos)
const LOGO_PLACEMENTS = [
  { position: "bottom-right corner", style: "watermark style, semi-transparent, clean overlay" },
  { position: "top-left corner", style: "small badge, integrated into the design" },
  { position: "bottom-left corner", style: "subtle placement, matching the overall aesthetic" },
  { position: "top-left corner, next to logo 2", style: "small badge, grouped with logo 2, harmonious pairing" },
];

/**
 * Retry wrapper for Gemini API calls that handles 429 rate-limit errors.
 * Uses the "retry in Xs" hint from the API to determine wait time.
 * If the suggested wait is short (< 5 min), retries automatically.
 * If the wait is long or missing, it's likely a daily limit — fail with a clear message.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 5,
  onRetry?: (attempt: number, maxRetries: number, delaySec: number) => void
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const isRateLimit =
        errMsg.includes("429") ||
        errMsg.includes("RESOURCE_EXHAUSTED") ||
        errMsg.includes("quota");

      if (!isRateLimit || attempt === maxRetries) {
        if (isRateLimit) {
          throw new Error(
            "מגבלת קצב של Gemini API. אנא נסה שוב בעוד דקה."
          );
        }
        throw error;
      }

      const retryMatch = errMsg.match(/retry in ([\d.]+)s/i);
      const suggestedDelaySec = retryMatch ? parseFloat(retryMatch[1]) : null;

      if (suggestedDelaySec === null || suggestedDelaySec > 300) {
        throw new Error(
          "מגבלת קצב של Gemini API. אנא נסה שוב בעוד דקה."
        );
      }

      // Add generous buffer to the suggested delay
      const delaySec = Math.ceil(suggestedDelaySec) + 5;
      console.log(
        `Rate limited (attempt ${attempt + 1}/${maxRetries}). API says retry in ${suggestedDelaySec}s, waiting ${delaySec}s...`
      );
      onRetry?.(attempt + 1, maxRetries, delaySec);
      await new Promise((resolve) => setTimeout(resolve, delaySec * 1000));
    }
  }
  throw new Error("Unreachable");
}

function isGeminiModelNotFoundError(message: string): boolean {
  return (
    message.includes("404") &&
    message.includes("models/") &&
    (message.includes("not found") || message.includes("NOT_FOUND"))
  );
}

function getUserFacingBannerError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const isRateLimit =
    message.includes("429") ||
    message.includes("RESOURCE_EXHAUSTED") ||
    message.includes("quota");

  if (isRateLimit) {
    return "מגבלת קצב API. אנא המתן מעט ונסה שוב.";
  }

  if (isGeminiModelNotFoundError(message)) {
    return `מודל יצירת התמונות של Gemini לא זמין: ${MODEL}. בדוק את GEMINI_IMAGE_MODEL או השתמש במודל פעיל כמו gemini-3.1-flash-image-preview.`;
  }

  return message;
}

function extractImageFromResponse(response: unknown): Uint8Array | null {
  const resp = response as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          inlineData?: {
            mimeType?: string;
            data?: string;
          };
        }>;
      };
    }>;
  };

  const parts = resp.candidates?.[0]?.content?.parts;
  if (!parts) return null;

  for (const part of parts) {
    if (part.inlineData?.data) {
      const base64 = part.inlineData.data;
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    }
  }
  return null;
}

// Map design preferences to English descriptions for visual style
const STYLE_MAP: Record<string, string> = {
  minimalist: "minimalist, clean, generous white space, simple geometric shapes, less is more",
  modern_tech: "modern tech, sleek digital interface, futuristic, glass morphism, gradients, circuit patterns",
  luxury: "luxury, elegant, premium, sophisticated, marble textures, gold accents, refined details",
  retro: "retro vintage, nostalgic 80s/90s aesthetic, analog textures, warm film grain",
  playful: "playful, vibrant colors, fun illustrations, energetic, youthful, dynamic shapes",
};

const COLOR_MAP: Record<string, string> = {
  brand_colors: "professional brand colors, cohesive palette",
  light_airy: "light and airy, white background with soft pastels, clean and fresh",
  dark_mode: "dark dramatic background, deep rich colors, high contrast with light text",
  pastel: "soft pastel palette, muted tones, gentle and calming",
  vibrant: "vibrant saturated colors, bold and eye-catching, high energy",
};

// Material styles based on aesthetic - describes how the Hebrew text should look
const MATERIAL_MAP: Record<string, string> = {
  minimalist: "Clean, flat design with subtle shadow for depth. Solid color fill, sharp edges.",
  modern_tech: "3D extruded text with soft neon glow, glass-like or holographic effects, tech-inspired gradient",
  luxury: "Elegant gold or silver metallic finish with reflective highlights, embossed or debossed effect, premium texture",
  retro: "Vintage letterpress or neon sign style, textured with grain or halftone patterns",
  playful: "Bold 3D cartoon-style letters, vibrant gradients, fun shadows and highlights",
};

// Art Direction Maps - separate from content elements
const VISUAL_STYLE_MAP: Record<string, string> = {
  photorealistic: "Photorealistic photography, 4K resolution, cinematic lighting, depth of field, professional quality",
  three_d_render: "3D render, Unreal Engine 5 quality, clay render aesthetic, soft shadows, isometric if relevant",
  vector_flat: "Minimalist vector illustration, flat design, clean lines, solid colors, corporate Memphis style",
  abstract_tech: "Abstract tech visualization, data visualization style, glowing geometry, network nodes, digital aesthetic",
  hand_drawn: "Hand-drawn watercolor illustration, artistic sketch style, organic textures, painterly feel",
};

const COMPOSITION_RULE_MAP: Record<string, string> = {
  text_center: "Centered composition with text as the main focal point, symmetrical balance",
  text_side_negative_space: "Wide shot with 40% clean negative space on the LEFT side reserved for Hebrew text overlay. Keep this area uncluttered with simple gradient or solid color.",
  knolling: "Knolling arrangement - objects laid flat, top-down view at 90-degree angles, organized grid",
  rule_of_thirds: "Rule of thirds composition, cinematic framing, balanced asymmetry",
  bento_grid: "Bento grid layout with clean rectangular sections, modern compartmentalized design",
};

const LIGHTING_MOOD_MAP: Record<string, string> = {
  golden_hour: "Golden hour lighting with warm amber and orange tones, inviting atmosphere",
  soft_studio: "Professional soft studio lighting, even illumination, commercial photography quality",
  neon_cyberpunk: "Neon cyberpunk lighting with dramatic glows, electric blues and magentas",
  rembrandt: "Rembrandt lighting with dramatic directional shadows, artistic and moody",
  natural_bright: "Natural bright daylight, clear and fresh, outdoor feel",
};

const COLOR_MOOD_MAP: Record<string, string> = {
  corporate: "Corporate professional palette - navy blues, clean whites, trustworthy grays",
  creative_vibrant: "Vibrant saturated colors, bold and eye-catching, high energy",
  luxury_dark: "Luxury dark palette - deep blacks, gold accents, premium sophisticated feel",
  pastel_soft: "Soft pastel palette - muted gentle tones, calming and approachable",
  monochromatic: "Monochromatic color scheme - variations of a single color for cohesion",
};

/**
 * Extract dominant colors from an image using node-vibrant
 */
async function extractColorsFromImage(imageBytes: Uint8Array): Promise<{
  primary: string;
  accent: string;
}> {
  try {
    const buffer = Buffer.from(imageBytes);
    const palette = await Vibrant.from(buffer).getPalette();

    // Use Vibrant as primary (bright, attention-grabbing)
    // Use DarkVibrant as accent (good for text, headers)
    const primary = palette.Vibrant?.hex || "#13ecda";
    const accent = palette.DarkVibrant?.hex || palette.Muted?.hex || "#1a1a2e";

    console.log("Extracted colors:", { primary, accent, fullPalette: Object.keys(palette) });

    return { primary, accent };
  } catch (error) {
    console.error("Failed to extract colors:", error);
    return { primary: "#13ecda", accent: "#1a1a2e" };
  }
}

async function generateHeroBackground(
  client: GoogleGenAI,
  course: CourseData,
  design?: DesignPreferences,
  branding?: { logos?: Logo[]; colors?: BrandingColors },
  onRetry?: (attempt: number, maxRetries: number, delaySec: number) => void
): Promise<Uint8Array> {
  const aestheticStyle = design?.aesthetic_style || "modern_tech";
  const style = STYLE_MAP[aestheticStyle] || "modern professional";
  const colors = COLOR_MAP[design?.color_palette || "light_airy"] || "professional colors";

  const visualStyle = VISUAL_STYLE_MAP[design?.visual_style || "photorealistic"] || VISUAL_STYLE_MAP.photorealistic;
  const compositionRule = COMPOSITION_RULE_MAP[design?.composition_rule || "text_center"] || COMPOSITION_RULE_MAP.text_center;
  const lightingMood = LIGHTING_MOOD_MAP[design?.lighting_mood || "soft_studio"] || LIGHTING_MOOD_MAP.soft_studio;
  const colorMood = COLOR_MOOD_MAP[design?.color_mood || "corporate"] || COLOR_MOOD_MAP.corporate;

  const brandColorDesc = branding?.colors?.primary
    ? `Use ${branding.colors.primary} as primary color${branding.colors.accent ? ` and ${branding.colors.accent} as accent` : ""}`
    : colors;

  const promptText = `Create a 16:9 professional background image for a course landing page.

GOAL: Hero background image for a course about "${course.title_he}" - NO TEXT IN THE IMAGE.

SUBJECT: Visual elements that represent the course theme/topic.
This is a BACKGROUND image - it will have text overlaid on top of it later.

CONTEXT: Professional education, adult learners, trustworthy brand tone.

LAYOUT: ${compositionRule}
- Leave clean areas for text overlay (especially center or left side)
- Background should be visually interesting but not busy
- Subtle, elegant visual elements

STYLE:
- Visual: ${visualStyle}
- Lighting: ${lightingMood}
- Colors: ${colorMood}
- Design: ${style}
- Brand colors: ${brandColorDesc}

CRITICAL RULES:
- ABSOLUTELY NO TEXT, LETTERS, WORDS, OR CHARACTERS in the image
- No Hebrew, English, or any other language text
- Clean background suitable for text overlay
- Subtle visual elements that don't compete with future text overlay
- Professional, polished look

OUTPUT: Single high-quality 16:9 background image with NO TEXT whatsoever.`;

  console.log("Generating hero background with model:", MODEL);

  const imageBytes = await withRetry(
    async () => {
      const response = await client.models.generateContent({
        model: MODEL,
        contents: [{ role: "user", parts: [{ text: promptText }] }],
        config: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      });

      const bytes = extractImageFromResponse(response);
      if (!bytes) {
        throw new Error(`No image returned from Gemini for hero background. Model: ${MODEL}`);
      }
      return bytes;
    },
    3,
    onRetry
  );

  return imageBytes;
}

async function generateBannerImage(
  client: GoogleGenAI,
  course: CourseData,
  design?: DesignPreferences,
  branding?: { logos?: Logo[]; colors?: BrandingColors },
  logosBase64?: string[],
  onRetry?: (attempt: number, maxRetries: number, delaySec: number) => void
): Promise<Uint8Array> {
  // Legacy style mappings (for backward compatibility)
  const aestheticStyle = design?.aesthetic_style || "modern_tech";
  const style = STYLE_MAP[aestheticStyle] || "modern professional";
  const colors = COLOR_MAP[design?.color_palette || "light_airy"] || "professional colors";
  const material = MATERIAL_MAP[aestheticStyle] || "Clean professional finish";

  // New Art Direction mappings
  const visualStyle = VISUAL_STYLE_MAP[design?.visual_style || "photorealistic"] || VISUAL_STYLE_MAP.photorealistic;
  const compositionRule = COMPOSITION_RULE_MAP[design?.composition_rule || "text_center"] || COMPOSITION_RULE_MAP.text_center;
  const lightingMood = LIGHTING_MOOD_MAP[design?.lighting_mood || "soft_studio"] || LIGHTING_MOOD_MAP.soft_studio;
  const colorMood = COLOR_MOOD_MAP[design?.color_mood || "corporate"] || COLOR_MOOD_MAP.corporate;

  // Build brand color description
  const brandColorDesc = branding?.colors?.primary
    ? `Use ${branding.colors.primary} as primary color${branding.colors.accent ? ` and ${branding.colors.accent} as accent` : ""}`
    : colors;

  // Build course details section
  const courseDetails = [];
  if (course.schedule?.dates) courseDetails.push(course.schedule.dates);
  if (course.schedule?.days && course.schedule?.time) {
    courseDetails.push(`${course.schedule.days} | ${course.schedule.time}`);
  }
  if (course.location) courseDetails.push(course.location);
  if (course.duration) courseDetails.push(course.duration);
  const detailsText = courseDetails.length > 0 ? courseDetails.join(" • ") : "";

  // Build a clear, focused prompt for Hebrew banner generation
  // Using "separation of concerns" - Art Direction separate from Content Elements
  const promptText = `Create a professional marketing banner image for an online course.

=== ART DIRECTION ===
Visual Style: ${visualStyle}
Composition: ${compositionRule}
Lighting: ${lightingMood}
Color Palette: ${colorMood}
Design Language: ${style}

=== CONTENT ELEMENTS (Hebrew - CRITICAL) ===

HEBREW TEXT TO DISPLAY ON THE BANNER (COPY EXACTLY AS WRITTEN):

1. HEADLINE (largest text):
"${course.title_he}"

2. SUBTITLE (medium text, below headline):
${course.subtitle_he && course.subtitle_he !== course.title_he ? `"${course.subtitle_he}"` : "(no subtitle)"}

3. COURSE DETAILS (smaller text, bottom area):
${detailsText ? `"${detailsText}"` : "(no details)"}

=== TYPOGRAPHY ===
- Text style: ${material}
- Hebrew font: Modern sans-serif (like Heebo or Rubik)
- All Hebrew characters must be crisp, sharp, and perfectly spelled
- All text in Hebrew, RIGHT-TO-LEFT (RTL)
- High contrast between text and background

=== TECHNICAL SPECS ===
- Aspect ratio: 16:9 (wide banner format)
- Brand colors: ${brandColorDesc}

=== INTEGRATION RULES ===
- The visual style must harmonize with the Hebrew text overlay
- Respect the composition rule - leave negative space where specified for text
- Do NOT place busy visual elements behind text areas
- Ensure text remains fully legible against the background
- Leave breathing room around all text elements

OUTPUT: A single high-quality 16:9 banner image with all the Hebrew text displayed`;

  // Build logo integration instructions if logos are provided
  let logoInstructions = "";
  const validLogos = logosBase64?.filter((logo) => logo && !logo.startsWith("PHN2")) || [];

  if (validLogos.length > 0) {
    logoInstructions = `

LOGO INTEGRATION (${validLogos.length} logo(s) provided as reference images):
Integrate the provided logo images naturally into the banner design.
${validLogos.map((_, i) => `- Logo ${i + 1}: ${LOGO_PLACEMENTS[i]?.position || "corner placement"}, ${LOGO_PLACEMENTS[i]?.style || "subtle integration"}`).join("\n")}

Important for logos:
- Keep logos recognizable and undistorted
- Ensure logos don't overlap with Hebrew text
- Blend logos harmoniously with the overall design aesthetic`;
  }

  const fullPrompt = promptText + logoInstructions;
  console.log("Generating banner with prompt:", fullPrompt);

  // Build the content parts
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: fullPrompt },
  ];

  // Add logo images (skip SVG - not supported by Gemini)
  for (const logoBase64 of validLogos) {
    const mimeType = logoBase64.startsWith("/9j/") ? "image/jpeg" : "image/png";
    parts.push({
      inlineData: {
        mimeType,
        data: logoBase64,
      },
    });
  }

  if (validLogos.length > 0) {
    console.log(`Including ${validLogos.length} logo(s) as reference images`);
  }

  const imageBytes = await withRetry(
    async () => {
      const response = await client.models.generateContent({
        model: MODEL,
        contents: [{ role: "user", parts }],
        config: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      });

      const bytes = extractImageFromResponse(response);
      if (!bytes) {
        throw new Error(`No image returned from Gemini. Model: ${MODEL}`);
      }
      return bytes;
    },
    3,
    onRetry
  );

  return imageBytes;
}

/** Progress steps for client-side tracking */
type ProgressStep = "logos" | "banner" | "background" | "colors" | "done";

interface ProgressEvent {
  type: "progress";
  step: ProgressStep;
  message: string;
  progress: number; // 0-100
}

interface RetryEvent {
  type: "retry";
  step: ProgressStep;
  attempt: number;
  maxRetries: number;
  waitSeconds: number;
  message: string;
}

interface ResultEvent {
  type: "result";
  ok: true;
  /** Public URL of the banner full WebP variant. */
  banner: string;
  /** Public URL of the banner thumb WebP variant. */
  bannerThumb: string;
  /** Public URL of the hero background full WebP variant. */
  background: string;
  /** Public URL of the hero background thumb WebP variant. */
  backgroundThumb: string;
  /** Storage prefix (tmp/{sessionId}) the client passes back to create-landing. */
  sessionId: string;
  colors: { primary: string; accent: string };
}

interface ErrorEvent {
  type: "error";
  ok: false;
  error: string;
}

type SSEEvent = ProgressEvent | RetryEvent | ResultEvent | ErrorEvent;

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { ok: false, error: "GEMINI_API_KEY is missing" },
      { status: 500 }
    );
  }

  let body: BannerRequest;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { course, design, branding } = body;
  if (!course) {
    return Response.json(
      { ok: false, error: "Missing 'course' in request body" },
      { status: 400 }
    );
  }

  const currentUser = await getCurrentUser();
  const bannerStartedAt = Date.now();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: SSEEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      let sessionId = "";

      try {
        if (!isSupabaseConfigured()) {
          throw new Error(
            "Supabase Storage לא מוגדר. הוסף NEXT_PUBLIC_SUPABASE_URL ו-SUPABASE_SERVICE_ROLE_KEY ל-.env.local (ראה SUPABASE_SETUP.md)."
          );
        }

        // sessionId scopes the tmp/ prefix; the client passes it back to
        // create-landing so the server can move the files to courses/{landingId}/.
        sessionId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
        const storagePrefix = `tmp/${sessionId}`;

        await logUsageEvent({
          eventType: "banner_start",
          userId: currentUser?.id,
          sessionId,
          metadata: { model: MODEL },
        });

        const client = new GoogleGenAI({ apiKey });

        // Step 1: Fetch logos
        send({
          type: "progress",
          step: "logos",
          message: "טוען לוגואים...",
          progress: 5,
        });

        const logosBase64: string[] = [];
        const logos = branding?.logos || [];

        for (const logo of logos.slice(0, 4)) {
          if (!logo?.url) continue;
          try {
            const logoUrl = logo.url.startsWith("http")
              ? logo.url
              : `${getServerBaseUrlFromRequest(req)}${logo.url}`;
            const logoResponse = await fetch(logoUrl);
            if (logoResponse.ok) {
              const logoBuffer = await logoResponse.arrayBuffer();
              const base64 = Buffer.from(logoBuffer).toString("base64");
              logosBase64.push(base64);
            }
          } catch (e) {
            console.warn("Error fetching logo:", logo.name, e);
          }
        }

        // Step 2: Generate banner image
        send({
          type: "progress",
          step: "banner",
          message: "מייצר באנר עם טקסט... (בדרך כלל 15-30 שניות)",
          progress: 15,
        });

        const bannerBytes = await generateBannerImage(
          client, course, design, branding, logosBase64,
          (attempt, maxRetries, delaySec) => {
            send({
              type: "retry",
              step: "banner",
              attempt,
              maxRetries,
              waitSeconds: delaySec,
              message: `מגבלת קצב API. ממתין ${delaySec} שניות... (ניסיון ${attempt}/${maxRetries})`,
            });
          }
        );

        send({
          type: "progress",
          step: "banner",
          message: "באנר נוצר בהצלחה!",
          progress: 50,
        });

        // Step 3: Generate hero background
        send({
          type: "progress",
          step: "background",
          message: "מייצר תמונת רקע... (בדרך כלל 15-30 שניות)",
          progress: 55,
        });

        const heroBytes = await generateHeroBackground(
          client, course, design, branding,
          (attempt, maxRetries, delaySec) => {
            send({
              type: "retry",
              step: "background",
              attempt,
              maxRetries,
              waitSeconds: delaySec,
              message: `מגבלת קצב API. ממתין ${delaySec} שניות... (ניסיון ${attempt}/${maxRetries})`,
            });
          }
        );

        send({
          type: "progress",
          step: "background",
          message: "תמונת רקע נוצרה!",
          progress: 90,
        });

        // Step 4: Extract colors
        send({
          type: "progress",
          step: "colors",
          message: "מחלץ צבעים מהבאנר...",
          progress: 92,
        });

        const colors = await extractColorsFromImage(bannerBytes);

        // Step 4b: Upload variants to Storage in parallel.
        send({
          type: "progress",
          step: "colors",
          message: "שומר תמונות באחסון...",
          progress: 95,
        });

        const [bannerVariants, heroVariants] = await Promise.all([
          uploadImageVariants({
            prefix: storagePrefix,
            name: "banner",
            bytes: bannerBytes,
          }),
          uploadImageVariants({
            prefix: storagePrefix,
            name: "hero",
            bytes: heroBytes,
          }),
        ]);

        await logUsageEvent({
          eventType: "banner_success",
          userId: currentUser?.id,
          sessionId,
          metadata: {
            model: MODEL,
            durationMs: Date.now() - bannerStartedAt,
          },
        });

        // Step 5: Done
        send({
          type: "result",
          ok: true,
          banner: bannerVariants.fullUrl,
          bannerThumb: bannerVariants.thumbUrl,
          background: heroVariants.fullUrl,
          backgroundThumb: heroVariants.thumbUrl,
          sessionId,
          colors,
        });

        send({
          type: "progress",
          step: "done",
          message: "הכל מוכן!",
          progress: 100,
        });
      } catch (error) {
        console.error("Banner generation error:", error);

        const message =
          error instanceof Error ? error.message : String(error);
        await logUsageEvent({
          eventType: "banner_error",
          userId: currentUser?.id,
          sessionId: sessionId || undefined,
          metadata: {
            model: MODEL,
            durationMs: Date.now() - bannerStartedAt,
            error: message.slice(0, 500),
          },
        });

        send({
          type: "error",
          ok: false,
          error: getUserFacingBannerError(error),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
