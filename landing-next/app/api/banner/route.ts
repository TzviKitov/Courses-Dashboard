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
import { canCreateCourses } from "@/lib/auth/admin";
import { assertRateLimit, RateLimitError, rateLimitResponse } from "@/lib/security/rate-limit";
import { clientIpFromRequest } from "@/lib/security/request-meta";
import { getServerBaseUrlFromRequest } from "@/lib/server-base-url";
import { compositeLogosOntoBanner, MAX_LOGOS } from "@/lib/logos/composite-banner";
import { buildDetailsText, detailsLineAvailable, drawDetailsLine } from "@/lib/logos/details-line";
import { detectFileKind, looksLikeSvg } from "@/lib/security/file-magic";
import {
  buildColorPrompt,
  buildCompositionPrompt,
  buildVisualStylesPrompt,
} from "@/constants/design-guide";
import { getFontById, DEFAULT_FONT } from "@/constants/fonts";
import type { DesignPreferences as GuideDesignPreferences } from "@/types/course";

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

interface BannerRequest {
  course: CourseData;
  design?: GuideDesignPreferences;
  branding?: {
    logos?: Logo[];
    colors?: BrandingColors;
  };
  /** Reuse tmp session from prior flyer/inspiration upload */
  sessionId?: string;
}

type ContentPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

async function fetchImageAsBase64(
  url: string,
  req: Request
): Promise<{ mimeType: string; data: string } | null> {
  try {
    const absolute = url.startsWith("http")
      ? url
      : `${getServerBaseUrlFromRequest(req)}${url}`;
    const res = await fetch(absolute);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const bytes = Buffer.from(buf);
    const contentType = res.headers.get("content-type") || "";
    const mimeType = contentType.includes("jpeg")
      ? "image/jpeg"
      : contentType.includes("webp")
        ? "image/webp"
        : "image/png";
    return { mimeType, data: bytes.toString("base64") };
  } catch (e) {
    console.warn("Failed to fetch image for Gemini:", url, e);
    return null;
  }
}

async function fetchLogoBytes(
  url: string,
  req: Request,
  signal?: AbortSignal
): Promise<Uint8Array | null> {
  try {
    const absolute = url.startsWith("http")
      ? url
      : `${getServerBaseUrlFromRequest(req)}${url}`;
    const res = await fetch(absolute, { signal });
    if (!res.ok) {
      console.warn("Logo fetch failed:", res.status, absolute);
      return null;
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    const kind = detectFileKind(buf);
    if (kind === "png" || kind === "jpeg" || kind === "webp" || kind === "gif") {
      return buf;
    }
    if (looksLikeSvg(buf)) return buf;
    console.warn("Logo bytes are not a usable image:", absolute);
    return null;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw e;
    console.warn("Failed to fetch logo:", url, e);
    return null;
  }
}

function buildArtDirection(design?: GuideDesignPreferences): {
  visualStyles: string;
  composition: string;
  colors: string;
  fontHint: string;
  backgroundSubject: string;
} {
  const visualStyles = buildVisualStylesPrompt(design?.visual_styles || ["realistic"]);
  const composition = buildCompositionPrompt(design?.compositions || ["pyramid"]);
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
    colors,
    fontHint: font.geminiHint,
    backgroundSubject,
  };
}

/**
 * Retry wrapper for Gemini API calls that handles 429 rate-limit errors.
 * Uses the "retry in Xs" hint from the API to determine wait time.
 * If the suggested wait is short (< 5 min), retries automatically.
 * If the wait is long or missing, it's likely a daily limit — fail with a clear message.
 */
function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    const err = new Error("Generation cancelled");
    err.name = "AbortError";
    throw err;
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      const err = new Error("Generation cancelled");
      err.name = "AbortError";
      reject(err);
      return;
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      const err = new Error("Generation cancelled");
      err.name = "AbortError";
      reject(err);
    };

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 5,
  onRetry?: (attempt: number, maxRetries: number, delaySec: number) => void,
  signal?: AbortSignal
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    throwIfAborted(signal);
    try {
      return await fn();
    } catch (error: unknown) {
      if (isAbortError(error)) throw error;

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
      await sleep(delaySec * 1000, signal);
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
  design?: GuideDesignPreferences,
  branding?: { logos?: Logo[]; colors?: BrandingColors },
  inspirationBase64?: { mimeType: string; data: string } | null,
  onRetry?: (attempt: number, maxRetries: number, delaySec: number) => void,
  signal?: AbortSignal
): Promise<Uint8Array> {
  const art = buildArtDirection(design);

  const brandColorDesc = branding?.colors?.primary
    ? `Also emphasize ${branding.colors.primary} as primary${branding.colors.accent ? ` and ${branding.colors.accent} as accent` : ""}`
    : "";

  const promptText = `Create a 16:9 professional background image for a course landing page.

GOAL: Hero background for a course about "${course.title_he}". The image contains no writing of any kind.

BACKGROUND CONCEPT: ${art.backgroundSubject}

SUBJECT: Visual elements that represent the course theme. Text is overlaid on top of this image later.

CONTEXT: Youth and young adults, professional education, trustworthy brand tone.

LAYOUT / COMPOSITION: ${art.composition}
- Calm, uncluttered areas for the text overlay; interesting but not busy; subtle, elegant details

STYLE:
- Visual: ${art.visualStyles}
- Colors: ${art.colors}
${brandColorDesc ? `- Brand overrides: ${brandColorDesc}` : ""}

RULES:
- No letters, numbers, words, logos or watermarks in any language. Signs, screens, boards, posters, books and papers are blank or show abstract shapes only
- A reference image, if attached, sets only mood, colors and style: never copy anything written on it
- Professional, polished look

OUTPUT: One high-quality 16:9 image, no writing.`;

  console.log("Generating hero background with model:", MODEL);

  const parts: ContentPart[] = [{ text: promptText }];
  if (inspirationBase64) {
    parts.push({
      inlineData: {
        mimeType: inspirationBase64.mimeType,
        data: inspirationBase64.data,
      },
    });
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
        throw new Error(`No image returned from Gemini for hero background. Model: ${MODEL}`);
      }
      return bytes;
    },
    3,
    onRetry,
    signal
  );

  return imageBytes;
}

async function generateBannerImage(
  client: GoogleGenAI,
  course: CourseData,
  design?: GuideDesignPreferences,
  branding?: { logos?: Logo[]; colors?: BrandingColors },
  inspirationBase64?: { mimeType: string; data: string } | null,
  onRetry?: (attempt: number, maxRetries: number, delaySec: number) => void,
  signal?: AbortSignal
): Promise<Uint8Array> {
  const art = buildArtDirection(design);

  const brandColorDesc = branding?.colors?.primary
    ? `Also emphasize ${branding.colors.primary} as primary${branding.colors.accent ? ` and ${branding.colors.accent} as accent` : ""}`
    : "";

  const detailsByCode = await detailsLineAvailable();
  const detailsText = buildDetailsText(course);

  const hasSubtitle = Boolean(
    course.subtitle_he && course.subtitle_he !== course.title_he
  );
  const textItemCount =
    1 + (hasSubtitle ? 1 : 0) + (!detailsByCode && detailsText ? 1 : 0);

  const promptText = `Create a professional marketing banner image for a course or group for youth and young adults.

=== ART DIRECTION ===
Visual Style: ${art.visualStyles}
Composition: ${art.composition}
Color Palette: ${art.colors}
${brandColorDesc ? `Brand overrides: ${brandColorDesc}` : ""}
Background / scene concept: ${art.backgroundSubject}

=== HEBREW TEXT ===
The banner contains exactly ${textItemCount} text item${textItemCount > 1 ? "s" : ""}, each shown once, copied letter by letter as written, with nothing else written anywhere:

1. HEADLINE (largest text):
"${course.title_he}"
${hasSubtitle ? `
2. SUBTITLE (medium text, below the headline):
"${course.subtitle_he}"
` : ""}${detailsByCode ? "\nDo NOT write dates, times, location, or number of sessions anywhere. Keep the bottom 12% of the image calm and plain with no text: the course details line is added there afterwards." : detailsText ? `\n${hasSubtitle ? "3" : "2"}. DETAILS (smaller text, bottom area):\n"${detailsText}"` : ""}

=== TYPOGRAPHY ===
- Hebrew font direction: ${art.fontHint}
- Hebrew, right-to-left. Keep digits, hyphens and parentheses exactly in the given order
- Crisp, sharp, perfectly spelled letters with high contrast against the background

=== LAYOUT ===
- Plan the scene around the text: respect the composition rule and keep the text in calm, empty areas with breathing room, never over busy detail
- Every face and head stays fully visible, uncovered and inside the frame. Text goes beside or above the people, never on them
- No logos, emblems, partner marks, watermarks or labeled boxes, and never the words "logo" or "לוגו"
- Keep the top 12% of the image as a calm, plain band with no text or detail (partner logos are added there later)

OUTPUT: One high-quality 16:9 banner image.`;

  console.log("Generating banner with prompt:", promptText);

  const parts: ContentPart[] = [{ text: promptText }];

  if (inspirationBase64) {
    parts.push({
      inlineData: {
        mimeType: inspirationBase64.mimeType,
        data: inspirationBase64.data,
      },
    });
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
    onRetry,
    signal
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
  const user = await getCurrentUser();
  if (!user || !canCreateCourses(user)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    await assertRateLimit({
      bucket: "banner",
      key: `${user.id}:${clientIpFromRequest(req)}`,
      max: 20,
      windowSec: 3600,
    });
  } catch (err) {
    if (err instanceof RateLimitError) return rateLimitResponse(err);
    throw err;
  }

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

  const skipBannerAi =
    design?.source === "upload" &&
    Boolean(design.uploaded_flyer_url) &&
    design.background_mode === "generate";

  // same_as_flyer is handled client-side; reject accidental calls
  if (
    design?.source === "upload" &&
    design.background_mode === "same_as_flyer"
  ) {
    return Response.json(
      {
        ok: false,
        error: "same_as_flyer is applied on the client; no AI generation needed",
      },
      { status: 400 }
    );
  }

  const currentUser = await getCurrentUser();
  const bannerStartedAt = Date.now();
  const signal = req.signal;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: SSEEvent) => {
        throwIfAborted(signal);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      let sessionId = "";

      try {
        throwIfAborted(signal);

        if (!isSupabaseConfigured()) {
          throw new Error(
            "Supabase Storage לא מוגדר. הוסף NEXT_PUBLIC_SUPABASE_URL ו-SUPABASE_SERVICE_ROLE_KEY ל-.env.local (ראה SUPABASE_SETUP.md)."
          );
        }

        // sessionId scopes the tmp/ prefix; the client passes it back to
        // create-landing so the server can move the files to courses/{landingId}/.
        sessionId =
          (body.sessionId && String(body.sessionId).trim()) ||
          `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
        const storagePrefix = `tmp/${sessionId}`;

        await logUsageEvent({
          eventType: "banner_start",
          userId: currentUser?.id,
          sessionId,
          metadata: { model: MODEL, skipBannerAi },
        });

        const client = new GoogleGenAI({ apiKey });

        // Inspiration image (optional)
        let inspirationBase64: { mimeType: string; data: string } | null = null;
        if (
          design?.background_prompt?.mode === "inspiration" &&
          design.background_prompt.inspiration_url
        ) {
          throwIfAborted(signal);
          inspirationBase64 = await fetchImageAsBase64(
            design.background_prompt.inspiration_url,
            req
          );
        }

        // Step 1: Fetch logos to overlay after generation (not sent to Gemini)
        send({
          type: "progress",
          step: "logos",
          message: "טוען לוגואים...",
          progress: 5,
        });

        const logoBuffers: Uint8Array[] = [];
        const logos = branding?.logos || [];

        if (!skipBannerAi) {
          for (const logo of logos.slice(0, MAX_LOGOS)) {
            throwIfAborted(signal);
            if (!logo?.url) continue;
            const bytes = await fetchLogoBytes(logo.url, req, signal);
            if (bytes) logoBuffers.push(bytes);
            else console.warn("Could not load logo for banner overlay:", logo.name);
          }
        }

        let bannerVariants: { fullUrl: string; thumbUrl: string };
        let bannerBytesForColors: Uint8Array | null = null;

        throwIfAborted(signal);

        if (skipBannerAi) {
          send({
            type: "progress",
            step: "banner",
            message: "משתמש בפלאייר שהועלה...",
            progress: 40,
          });
          bannerVariants = {
            fullUrl: design!.uploaded_flyer_url!,
            thumbUrl:
              design!.uploaded_flyer_thumb_url || design!.uploaded_flyer_url!,
          };
          // Fetch uploaded flyer for color extraction
          const flyerImg = await fetchImageAsBase64(
            design!.uploaded_flyer_url!,
            req
          );
          if (flyerImg) {
            bannerBytesForColors = new Uint8Array(
              Buffer.from(flyerImg.data, "base64")
            );
          }
        } else {
          // Step 2: Generate banner image
          send({
            type: "progress",
            step: "banner",
            message: "מייצר באנר עם טקסט... (בדרך כלל 15-30 שניות)",
            progress: 15,
          });

          let bannerBytes = await generateBannerImage(
            client,
            course,
            design,
            branding,
            inspirationBase64,
            (attempt, maxRetries, delaySec) => {
              send({
                type: "retry",
                step: "banner",
                attempt,
                maxRetries,
                waitSeconds: delaySec,
                message: `מגבלת קצב API. ממתין ${delaySec} שניות... (ניסיון ${attempt}/${maxRetries})`,
              });
            },
            signal
          );

          throwIfAborted(signal);

          // Exact dates/place/sessions drawn by us (the model garbles small Hebrew + numbers).
          bannerBytes = await drawDetailsLine(bannerBytes, buildDetailsText(course));

          if (logoBuffers.length > 0) {
            send({
              type: "progress",
              step: "logos",
              message: "משלב לוגואים בבאנר...",
              progress: 48,
            });
            bannerBytes = await compositeLogosOntoBanner(bannerBytes, logoBuffers);
          }

          bannerBytesForColors = bannerBytes;

          throwIfAborted(signal);

          send({
            type: "progress",
            step: "banner",
            message: "באנר נוצר בהצלחה!",
            progress: 50,
          });

          bannerVariants = await uploadImageVariants({
            prefix: storagePrefix,
            name: "banner",
            bytes: bannerBytes,
          });
        }

        throwIfAborted(signal);

        // Step 3: Generate hero background
        send({
          type: "progress",
          step: "background",
          message: "מייצר תמונת רקע... (בדרך כלל 15-30 שניות)",
          progress: 55,
        });

        const heroBytes = await generateHeroBackground(
          client,
          course,
          design,
          branding,
          inspirationBase64,
          (attempt, maxRetries, delaySec) => {
            send({
              type: "retry",
              step: "background",
              attempt,
              maxRetries,
              waitSeconds: delaySec,
              message: `מגבלת קצב API. ממתין ${delaySec} שניות... (ניסיון ${attempt}/${maxRetries})`,
            });
          },
          signal
        );

        throwIfAborted(signal);

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

        const colors = bannerBytesForColors
          ? await extractColorsFromImage(bannerBytesForColors)
          : { primary: "#13ecda", accent: "#1a1a2e" };

        // Prefer preset/manual palette primary/accent when provided
        if (design?.color_mode === "manual" && design.manual_colors?.length) {
          colors.primary = design.manual_colors[0];
          colors.accent = design.manual_colors[1] || colors.accent;
        } else if (design?.color_mode === "preset" && design.palette_ids?.[0]) {
          const { getPalette } = await import("@/constants/design-guide");
          const palette = getPalette(design.palette_ids[0]);
          if (palette) {
            colors.primary = palette.colors[0];
            colors.accent = palette.colors[1];
          }
        }

        throwIfAborted(signal);

        send({
          type: "progress",
          step: "colors",
          message: "שומר תמונות באחסון...",
          progress: 95,
        });

        const heroVariants = await uploadImageVariants({
          prefix: storagePrefix,
          name: "hero",
          bytes: heroBytes,
        });

        throwIfAborted(signal);

        await logUsageEvent({
          eventType: "banner_success",
          userId: currentUser?.id,
          sessionId,
          metadata: {
            model: MODEL,
            durationMs: Date.now() - bannerStartedAt,
            skipBannerAi,
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
        if (isAbortError(error) || signal.aborted) {
          console.log("Banner generation cancelled by client");
          await logUsageEvent({
            eventType: "banner_error",
            userId: currentUser?.id,
            sessionId: sessionId || undefined,
            metadata: {
              model: MODEL,
              durationMs: Date.now() - bannerStartedAt,
              error: "cancelled",
            },
          }).catch(() => {});
          return;
        }

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

        try {
          send({
            type: "error",
            ok: false,
            error: getUserFacingBannerError(error),
          });
        } catch {
          // Client may already have disconnected.
        }
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed (e.g. client abort).
        }
      }
    },
    cancel() {
      // Client disconnected / aborted the fetch — req.signal is already aborted.
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
