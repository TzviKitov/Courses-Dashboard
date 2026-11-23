import sharp from "sharp";
import { HEEBO_BOLD_BASE64 } from "@/lib/fonts/heebo-bold";

const FONT_FAMILY = "AvuHeebo";

type CanvasModule = typeof import("@napi-rs/canvas");
let canvasPromise: Promise<CanvasModule | null> | null = null;

/** Loads the native canvas and the font once. Null if either is unavailable. */
function loadCanvas(): Promise<CanvasModule | null> {
  if (!canvasPromise) {
    canvasPromise = (async () => {
      try {
        const mod = await import("@napi-rs/canvas");
        const ok = mod.GlobalFonts.register(
          Buffer.from(HEEBO_BOLD_BASE64, "base64"),
          FONT_FAMILY
        );
        return ok ? mod : null;
      } catch (error) {
        console.warn("Details line renderer is unavailable:", error);
        return null;
      }
    })();
  }
  return canvasPromise;
}

/** True when we can draw the details line ourselves (else the model writes it). */
export async function detailsLineAvailable(): Promise<boolean> {
  return (await loadCanvas()) !== null;
}

/** 2026-11-26 -> 26.11.2026 (day first, as Hebrew readers expect). */
export function formatDateHe(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso.trim();
}

/** "2026-11-26 - 2026-12-14" -> "26.11.2026 - 14.12.2026" (one date if both are equal). */
export function formatDateRangeHe(range: string): string {
  const dates = range.match(/\d{4}-\d{2}-\d{2}/g) ?? [];
  if (dates.length === 0) return range.trim();
  const start = dates[0] ?? "";
  const end = dates[1];
  if (!end || end === start) return formatDateHe(start);
  return `${formatDateHe(start)} - ${formatDateHe(end)}`;
}

/** Builds the details line: dates • days | time • location • duration. */
export function buildDetailsText(course: {
  duration?: string;
  location?: string;
  schedule?: { dates?: string; days?: string; time?: string };
}): string {
  const parts: string[] = [];
  if (course.schedule?.dates) parts.push(formatDateRangeHe(course.schedule.dates));
  if (course.schedule?.days && course.schedule?.time) {
    parts.push(`${course.schedule.days} | ${course.schedule.time}`);
  } else if (course.schedule?.time) {
    parts.push(course.schedule.time);
  }
  if (course.location) parts.push(course.location.trim());
  if (course.duration) parts.push(course.duration.trim());
  return parts.filter(Boolean).join(" • ");
}

/**
 * Draw the course details (dates, place, sessions) on the bottom of the banner
 * ourselves. Image models garble small Hebrew mixed with numbers; this is exact.
 */
export async function drawDetailsLine(
  bannerBytes: Uint8Array,
  text: string
): Promise<Uint8Array> {
  const canvasMod = await loadCanvas();
  if (!text.trim() || !canvasMod) return bannerBytes;
  const { createCanvas } = canvasMod;

  const meta = await sharp(Buffer.from(bannerBytes)).metadata();
  const w = meta.width;
  const h = meta.height;
  if (!w || !h) return bannerBytes;

  const maxTextW = w * 0.88;
  let fontSize = Math.round(h * 0.05);
  const probe = createCanvas(10, 10).getContext("2d");
  const measure = (size: number) => {
    probe.font = `700 ${size}px ${FONT_FAMILY}`;
    return probe.measureText(text).width;
  };
  while (fontSize > 14 && measure(fontSize) > maxTextW) fontSize -= 1;

  const textW = Math.ceil(measure(fontSize));
  const padX = Math.round(fontSize * 0.9);
  const pillW = textW + padX * 2;
  const pillH = Math.round(fontSize * 1.9);

  const canvas = createCanvas(pillW, pillH);
  const g = canvas.getContext("2d");
  g.fillStyle = "rgba(8, 22, 38, 0.84)";
  g.beginPath();
  g.roundRect(0, 0, pillW, pillH, Math.round(pillH * 0.3));
  g.fill();
  g.fillStyle = "#FFFFFF";
  g.font = `700 ${fontSize}px ${FONT_FAMILY}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  (g as unknown as { direction: string }).direction = "rtl";
  g.fillText(text, pillW / 2, pillH / 2 + Math.round(fontSize * 0.04));

  const bottomMargin = Math.round(h * 0.035);
  const out = await sharp(Buffer.from(bannerBytes))
    .composite([
      {
        input: canvas.toBuffer("image/png"),
        left: Math.round((w - pillW) / 2),
        top: Math.max(0, h - bottomMargin - pillH),
      },
    ])
    .png()
    .toBuffer();
  return new Uint8Array(out);
}
