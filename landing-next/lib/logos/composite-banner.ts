import sharp, { type OverlayOptions } from "sharp";

const MAX_LOGOS = 4;
/** Gradient above this counts as crisp detail (text edges). */
const EDGE_THRESHOLD = 48;
/** Above this share of crisp pixels a spot is treated as holding text. */
const BUSY_LIMIT = 0.035;

type Rect = { left: number; top: number; width: number; height: number };

/** Share of strong-edge pixels (text, sharp detail) in each candidate rectangle. */
async function measureBusyness(
  bannerBytes: Uint8Array,
  bannerW: number,
  bannerH: number,
  rects: Rect[]
): Promise<number[]> {
  const sw = 480;
  const k = sw / bannerW;
  const sh = Math.max(1, Math.round(bannerH * k));
  const { data } = await sharp(Buffer.from(bannerBytes))
    .resize(sw, sh, { fit: "fill" })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const edge = (x: number, y: number) => {
    const i = y * sw + x;
    return Math.abs(data[i] - data[i + 1]) + Math.abs(data[i] - data[i + sw]);
  };
  return rects.map((r) => {
    const x0 = Math.max(0, Math.floor(r.left * k));
    const y0 = Math.max(0, Math.floor(r.top * k));
    const x1 = Math.min(sw - 2, Math.ceil((r.left + r.width) * k));
    const y1 = Math.min(sh - 2, Math.ceil((r.top + r.height) * k));
    let strong = 0;
    let total = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        total++;
        if (edge(x, y) > EDGE_THRESHOLD) strong++;
      }
    }
    return total === 0 ? 1 : strong / total;
  });
}


/**
 * Overlay actual logo images onto a generated banner.
 * Gemini often draws labeled placeholder boxes instead of using reference
 * images; compositing after generation keeps the real marks.
 *
 * Placement: all logos in one row on a small light chip (first logo is the
 * municipality). The chip prefers the top-left corner, but we measure where the
 * banner has crisp text-like detail and move it to the quietest spot. If no spot
 * is clear, the banner is extended with a plain logo strip so nothing is ever
 * covered.
 */
export async function compositeLogosOntoBanner(
  bannerBytes: Uint8Array,
  logoBuffers: Uint8Array[]
): Promise<Uint8Array> {
  const logos = logoBuffers.filter((buf) => buf.length > 0).slice(0, MAX_LOGOS);
  if (logos.length === 0) return bannerBytes;

  const meta = await sharp(Buffer.from(bannerBytes)).metadata();
  const bannerW = meta.width;
  const bannerH = meta.height;
  if (!bannerW || !bannerH) return bannerBytes;

  const pad = Math.max(10, Math.round(Math.min(bannerW, bannerH) * 0.02));
  const chipPad = Math.max(6, Math.round(pad * 0.45));
  const gap = Math.max(8, Math.round(pad * 0.7));
  const maxH = Math.max(28, Math.round(bannerH * 0.055));
  // Whole chip stays under ~42% of the banner width, however many logos.
  const rowBudget = bannerW * 0.42 - chipPad * 2 - gap * (logos.length - 1);
  const maxW = Math.max(28, Math.round(Math.min(bannerW * 0.16, rowBudget / logos.length)));

  const prepared: { buf: Buffer; width: number; height: number }[] = [];
  for (const raw of logos) {
    try {
      const resized = await sharp(Buffer.from(raw), { density: 180 })
        .ensureAlpha()
        .resize({ width: maxW, height: maxH, fit: "inside" })
        .png()
        .toBuffer({ resolveWithObject: true });
      prepared.push({
        buf: resized.data,
        width: resized.info.width,
        height: resized.info.height,
      });
    } catch (error) {
      console.warn("Skipping logo that could not be composited:", error);
    }
  }

  if (prepared.length === 0) return bannerBytes;

  const rowW =
    prepared.reduce((sum, l) => sum + l.width, 0) + gap * (prepared.length - 1);
  const rowH = Math.max(...prepared.map((l) => l.height));
  const chipW = Math.round(rowW + chipPad * 2);
  const chipH = Math.round(rowH + chipPad * 2);
  const radius = Math.round(chipH * 0.22);
  const chip = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${chipW}" height="${chipH}">` +
      `<rect width="${chipW}" height="${chipH}" rx="${radius}" fill="#FFF8E6" fill-opacity="0.94"/></svg>`
  );

  // Candidate spots, in order of preference. The bottom ~16% (date strip) is never used.
  const margin = pad;
  const lowY = Math.round(bannerH * 0.62);
  const candidates: Rect[] = [
    { left: pad, top: pad, width: chipW, height: chipH },
    { left: bannerW - pad - chipW, top: pad, width: chipW, height: chipH },
    { left: pad, top: lowY, width: chipW, height: chipH },
    { left: bannerW - pad - chipW, top: lowY, width: chipW, height: chipH },
  ];
  const scores = await measureBusyness(
    bannerBytes,
    bannerW,
    bannerH,
    candidates.map((r) => ({
      left: r.left - margin,
      top: r.top - margin,
      width: r.width + margin * 2,
      height: r.height + margin * 2,
    }))
  );
  // Take the first preferred spot that is quiet; otherwise the quietest, if quiet enough.
  let pick = scores.findIndex((v) => v <= BUSY_LIMIT);
  if (pick < 0) {
    const min = Math.min(...scores);
    pick = min <= BUSY_LIMIT * 1.6 ? scores.indexOf(min) : -1;
  }

  let base = Buffer.from(bannerBytes);
  let spot: Rect;
  if (pick >= 0) {
    spot = candidates[pick];
  } else {
    // No clear spot: add a plain strip above the banner and put the logos there.
    const strip = chipH + pad * 2;
    base = await sharp(base)
      .extend({ top: strip, background: "#FFF8E6" })
      .png()
      .toBuffer();
    spot = { left: pad, top: pad, width: chipW, height: chipH };
  }

  const overlays: OverlayOptions[] = [
    { input: chip, left: spot.left, top: spot.top },
  ];
  let x = spot.left + chipPad;
  for (const logo of prepared) {
    overlays.push({
      input: logo.buf,
      left: Math.round(x),
      top: Math.round(spot.top + chipPad + (rowH - logo.height) / 2),
    });
    x += logo.width + gap;
  }

  const out = await sharp(base)
    .composite(overlays)
    .png()
    .toBuffer();
  return new Uint8Array(out);
}
