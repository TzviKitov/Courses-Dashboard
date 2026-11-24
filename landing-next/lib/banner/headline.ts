import sharp, { type OverlayOptions } from "sharp";
import { loadCanvas } from "../logos/details-line";
import { ensureBannerFont } from "./fonts";
import { bottomZonePercent, topZonePercent } from "../logos/reserved-bands";

/**
 * The headline and subtitle are drawn here, not by the image model. The model
 * garbled Hebrew, repeated the headline, drew solid panels behind it and put it
 * over people's heads. Here we choose where the text goes: the calmest area that
 * holds no skin tones, never inside the zones used by the logo strip and the
 * details line.
 */

export type Align = "center" | "right" | "left";

/** Greedy word wrap. `measure` returns the width of a string in pixels. */
export function wrapWords(
  text: string,
  measure: (s: string) => number,
  maxWidth: number
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** A scene downscaled for analysis: luminance, skin mask and strong-edge mask. */
export interface SceneAnalysis {
  w: number;
  h: number;
  /** analysis width / full-size width */
  scale: number;
  lum: Uint8Array;
  skin: Uint8Array;
  edge: Uint8Array;
}

const EDGE_STRONG = 48;

export function analyzeRaw(
  rgb: Uint8Array,
  w: number,
  h: number,
  scale: number
): SceneAnalysis {
  const lum = new Uint8Array(w * h);
  const skin = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = rgb[i * 3];
    const g = rgb[i * 3 + 1];
    const b = rgb[i * 3 + 2];
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    lum[i] = y;
    const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
    skin[i] = y > 45 && cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173 ? 1 : 0;
  }
  const edge = new Uint8Array(w * h);
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const i = y * w + x;
      const g = Math.abs(lum[i] - lum[i + 1]) + Math.abs(lum[i] - lum[i + w]);
      edge[i] = g > EDGE_STRONG ? 1 : 0;
    }
  }
  return { w, h, scale, lum, skin, edge };
}

export async function analyzeScene(bytes: Uint8Array, width = 480): Promise<SceneAnalysis | null> {
  const meta = await sharp(Buffer.from(bytes)).metadata();
  if (!meta.width || !meta.height) return null;
  const scale = width / meta.width;
  const h = Math.max(1, Math.round(meta.height * scale));
  const { data } = await sharp(Buffer.from(bytes))
    .removeAlpha()
    .resize(width, h, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return analyzeRaw(new Uint8Array(data), width, h, scale);
}

export interface RegionStats {
  edge: number;
  skin: number;
  meanLum: number;
  lumSpread: number;
}

/** Statistics of a rectangle given in full-size pixels. */
export function regionStats(
  a: SceneAnalysis,
  rect: { x: number; y: number; w: number; h: number }
): RegionStats {
  const x0 = Math.max(0, Math.floor(rect.x * a.scale));
  const y0 = Math.max(0, Math.floor(rect.y * a.scale));
  const x1 = Math.min(a.w - 1, Math.ceil((rect.x + rect.w) * a.scale));
  const y1 = Math.min(a.h - 1, Math.ceil((rect.y + rect.h) * a.scale));
  let n = 0;
  let edge = 0;
  let skin = 0;
  let sum = 0;
  let sumSq = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = y * a.w + x;
      n++;
      edge += a.edge[i];
      skin += a.skin[i];
      sum += a.lum[i];
      sumSq += a.lum[i] * a.lum[i];
    }
  }
  if (n === 0) return { edge: 0, skin: 0, meanLum: 128, lumSpread: 0 };
  const mean = sum / n;
  return {
    edge: edge / n,
    skin: skin / n,
    meanLum: mean,
    lumSpread: Math.sqrt(Math.max(0, sumSq / n - mean * mean)),
  };
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Share of `rect` covered by the obstacles (sum of overlaps, capped at 1). */
export function overlapFraction(rect: Rect, obstacles: Rect[]): number {
  const area = rect.w * rect.h;
  if (area <= 0) return 0;
  let covered = 0;
  for (const o of obstacles) {
    const w = Math.min(rect.x + rect.w, o.x + o.w) - Math.max(rect.x, o.x);
    const h = Math.min(rect.y + rect.h, o.y + o.h) - Math.max(rect.y, o.y);
    if (w > 0 && h > 0) covered += w * h;
  }
  return Math.min(1, covered / area);
}

export interface Placement {
  x: number;
  y: number;
  align: Align;
  stats: RegionStats;
  /** Share of the text block over people, 0 when it is clear of them. */
  overlap: number;
}

/**
 * Pick the position of a text block (full-size pixels). The block stays between the
 * top zone and the bottom zone, prefers calm areas, and avoids skin tones heavily
 * (faces, hands). Upper positions and the middle get a small preference.
 */
export function pickPlacement(
  a: SceneAnalysis,
  imageW: number,
  imageH: number,
  block: { w: number; h: number },
  zones: { topPct: number; bottomPct: number },
  /** People (full-size pixels). Overlapping them costs far more than anything else. */
  obstacles: Rect[] = []
): Placement {
  const margin = Math.round(imageW * 0.04);
  const yMin = Math.max(Math.round(imageH * 0.02), Math.round((imageH * zones.topPct) / 100) + Math.round(imageH * 0.01));
  const yMax = Math.max(
    yMin,
    Math.round(imageH * (1 - zones.bottomPct / 100)) - block.h - Math.round(imageH * 0.01)
  );
  const step = Math.max(2, Math.round(imageH * 0.01));
  const left = margin;
  const right = imageW - margin;
  const aligns: { align: Align; x: number; prior: number }[] = [
    { align: "center", x: Math.round((left + right - block.w) / 2), prior: 0 },
    { align: "right", x: right - block.w, prior: 0.01 },
    { align: "left", x: left, prior: 0.02 },
  ];
  let best: Placement | null = null;
  let bestCost = Infinity;
  for (const c of aligns) {
    for (let y = yMin; y <= yMax; y += step) {
      const rect = { x: c.x, y, w: block.w, h: block.h };
      const stats = regionStats(a, rect);
      const overlap = overlapFraction(rect, obstacles);
      const cost = overlap * 10 + stats.edge + stats.skin * 5 + (y / imageH) * 0.2 + c.prior;
      if (cost < bestCost) {
        bestCost = cost;
        best = { x: c.x, y, align: c.align, stats, overlap };
      }
    }
  }
  return (
    best ?? {
      x: margin,
      y: yMin,
      align: "center",
      stats: regionStats(a, { x: margin, y: yMin, w: block.w, h: block.h }),
      overlap: 0,
    }
  );
}

function scrimSvg(w: number, h: number, feather: number, color: string, opacity: number): Buffer {
  const blur = Math.max(2, Math.round(feather * 0.6));
  const radius = Math.round(Math.min(h * 0.35, 40));
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w + feather * 2}" height="${h + feather * 2}">` +
      `<defs><filter id="f" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="${blur}"/></filter></defs>` +
      `<rect x="${feather}" y="${feather}" width="${w}" height="${h}" rx="${radius}" fill="${color}" fill-opacity="${opacity}" filter="url(#f)"/></svg>`
  );
}

export interface HeadlineText {
  title: string;
  subtitle?: string;
  /** The banner font chosen in the create form (id from constants/fonts). */
  fontId?: string;
}

/**
 * Draw the headline and subtitle on a text-free scene. `logoCount` and
 * `hasDetailsLine` size the zones the text must stay out of.
 */
export async function drawHeadline(
  bannerBytes: Uint8Array,
  text: HeadlineText,
  zones: { logoCount: number; hasDetailsLine: boolean },
  people: Rect[] = []
): Promise<Uint8Array> {
  const canvasMod = await loadCanvas();
  const title = text.title.trim();
  if (!title || !canvasMod) return bannerBytes;
  const subtitle = text.subtitle && text.subtitle.trim() !== title ? text.subtitle.trim() : "";

  const meta = await sharp(Buffer.from(bannerBytes)).metadata();
  const W = meta.width;
  const H = meta.height;
  if (!W || !H) return bannerBytes;

  const { createCanvas } = canvasMod;
  const font = await ensureBannerFont(text.fontId);
  const probe = createCanvas(10, 10).getContext("2d");
  const measureAt = (size: number) => (s: string) => {
    probe.font = `${font.weight} ${size}px ${font.stack}`;
    return probe.measureText(s).width;
  };
  const maxW = W * 0.84;
  // People padded a little, in pixels.
  const pad2 = Math.round(Math.min(W, H) * 0.015);
  const obstacles: Rect[] = people.map((p) => ({
    x: p.x * W - pad2,
    y: p.y * H - pad2,
    w: p.w * W + pad2 * 2,
    h: p.h * H + pad2 * 2,
  }));

  const layoutAt = (titleStart: number) => {
    // Largest size that keeps the text to at most two lines.
    const fit = (value: string, startSize: number, minSize: number) => {
      let size = startSize;
      let lines = wrapWords(value, measureAt(size), maxW);
      while (size > minSize && (lines.length > 2 || lines.some((l) => measureAt(size)(l) > maxW))) {
        size -= 2;
        lines = wrapWords(value, measureAt(size), maxW);
      }
      return { size, lines };
    };
    const titleFit = fit(title, titleStart, Math.round(H * 0.04));
    const subSize = Math.max(18, Math.round(titleFit.size * 0.52));
    const subFit = subtitle ? fit(subtitle, subSize, Math.max(16, Math.round(subSize * 0.7))) : null;
    const titleLH = Math.round(titleFit.size * 1.16);
    const subLH = subFit ? Math.round(subFit.size * 1.2) : 0;
    const gap = subFit ? Math.round(titleFit.size * 0.22) : 0;
    const widest = Math.max(
      ...titleFit.lines.map((l) => measureAt(titleFit.size)(l)),
      ...(subFit ? subFit.lines.map((l) => measureAt(subFit.size)(l)) : [0])
    );
    const block = {
      w: Math.ceil(widest),
      h: titleFit.lines.length * titleLH + (subFit ? gap + subFit.lines.length * subLH : 0),
    };
    return { titleFit, subFit, titleLH, subLH, gap, block };
  };

  const analysis = await analyzeScene(bannerBytes);
  const zonesPct = {
    topPct: topZonePercent(zones.logoCount),
    bottomPct: bottomZonePercent(zones.hasDetailsLine),
  };
  const fallbackStats = { edge: 0, skin: 0, meanLum: 128, lumSpread: 0 };

  // Biggest text first; if it cannot avoid the people, try smaller text.
  const startSize = Math.round(H * 0.092);
  let best: { layout: ReturnType<typeof layoutAt>; placement: Placement } | null = null;
  for (const factor of [1, 0.85, 0.72, 0.6]) {
    const layout = layoutAt(Math.max(Math.round(startSize * factor), Math.round(H * 0.04)));
    const placement = analysis
      ? pickPlacement(analysis, W, H, layout.block, zonesPct, obstacles)
      : { x: Math.round((W - layout.block.w) / 2), y: Math.round(H * 0.16), align: "center" as Align, stats: fallbackStats, overlap: 0 };
    if (!best || placement.overlap < best.placement.overlap) best = { layout, placement };
    if (placement.overlap === 0) break;
  }
  const { layout, placement } = best!;
  const { titleFit, subFit, titleLH, subLH, gap, block } = layout;

  const light = placement.stats.meanLum >= 140;
  const ink = light ? "#0B1F33" : "#FFFFFF";
  const scrimColor = light ? "#FFFFFF" : "#08121E";

  const pad = Math.round(titleFit.size * 0.3);
  const canvas = createCanvas(block.w + pad * 2, block.h + pad * 2);
  const g = canvas.getContext("2d");
  (g as unknown as { direction: string }).direction = "rtl";
  g.textBaseline = "top";
  g.shadowColor = light ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.55)";
  g.shadowBlur = Math.round(titleFit.size * 0.12);
  g.fillStyle = ink;
  const anchorX =
    placement.align === "right" ? pad + block.w : placement.align === "left" ? pad : pad + block.w / 2;
  g.textAlign = placement.align === "center" ? "center" : placement.align;
  let cy = pad;
  g.font = `${font.weight} ${titleFit.size}px ${font.stack}`;
  for (const line of titleFit.lines) {
    g.fillText(line, anchorX, cy);
    cy += titleLH;
  }
  if (subFit) {
    cy += gap;
    g.font = `${font.weight} ${subFit.size}px ${font.stack}`;
    g.globalAlpha = 0.92;
    for (const line of subFit.lines) {
      g.fillText(line, anchorX, cy);
      cy += subLH;
    }
  }

  // Soft scrim for contrast: feathered, translucent, never a solid panel.
  const feather = Math.max(0, Math.min(Math.round(titleFit.size * 0.45), placement.x - pad, placement.y - pad));
  const textLeft = Math.max(0, placement.x - pad);
  const textTop = Math.max(0, placement.y - pad);
  const scrimW = Math.min(W - textLeft - feather, block.w + pad * 2);
  const scrimH = Math.min(H - textTop - feather, block.h + pad * 2);
  const overlays: OverlayOptions[] = [];
  if (feather >= 4) {
    overlays.push({
      input: scrimSvg(scrimW, scrimH, feather, scrimColor, placement.stats.lumSpread > 30 ? 0.34 : 0.2),
      left: textLeft - feather,
      top: textTop - feather,
    });
  }
  overlays.push({ input: canvas.toBuffer("image/png"), left: textLeft, top: textTop });

  const out = await sharp(Buffer.from(bannerBytes)).composite(overlays).png().toBuffer();
  return new Uint8Array(out);
}
