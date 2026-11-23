import sharp, { type OverlayOptions } from "sharp";

export const MAX_LOGOS = 15;
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
type Placed = { buf: Buffer; dx: number; dy: number };
type Layout = { items: Placed[]; width: number; height: number };

/**
 * Lay the logos out in rows inside a chip. `widthFrac` limits the chip width and
 * `perRowMax` the logos per row; more logos means more rows and smaller marks.
 */
async function layoutLogos(
  logos: Uint8Array[],
  bannerW: number,
  bannerH: number,
  widthFrac: number,
  perRowMax: number,
  pad: number
): Promise<Layout | null> {
  const chipPad = Math.max(6, Math.round(pad * 0.45));
  const gap = Math.max(8, Math.round(pad * 0.7));
  const rows = Math.ceil(logos.length / perRowMax);
  const perRow = Math.ceil(logos.length / rows);
  const maxH = Math.max(
    24,
    Math.round(bannerH * (rows === 1 ? 0.055 : rows === 2 ? 0.048 : 0.042))
  );
  const rowBudget = bannerW * widthFrac - chipPad * 2 - gap * (perRow - 1);
  const maxW = Math.max(24, Math.round(Math.min(bannerW * 0.16, rowBudget / perRow)));

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
  if (prepared.length === 0) return null;

  const items: Placed[] = [];
  let y = chipPad;
  let widest = 0;
  for (let r = 0; r * perRow < prepared.length; r++) {
    const row = prepared.slice(r * perRow, (r + 1) * perRow);
    const rowH = Math.max(...row.map((l) => l.height));
    let x = chipPad;
    for (const logo of row) {
      items.push({ buf: logo.buf, dx: x, dy: Math.round(y + (rowH - logo.height) / 2) });
      x += logo.width + gap;
    }
    widest = Math.max(widest, x - gap + chipPad);
    y += rowH + gap;
  }
  return { items, width: Math.round(widest), height: Math.round(y - gap + chipPad) };
}

function chipSvg(w: number, h: number): Buffer {
  const radius = Math.round(Math.min(h * 0.22, 22));
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
      `<rect width="${w}" height="${h}" rx="${radius}" fill="#FFF8E6" fill-opacity="0.94"/></svg>`
  );
}

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
  const layout = await layoutLogos(logos, bannerW, bannerH, 0.42, 5, pad);
  if (!layout) return bannerBytes;
  const chipW = layout.width;
  const chipH = layout.height;

  // Candidate spots, in order of preference. The bottom ~16% (date strip) is never used.
  const margin = pad;
  const lowY = Math.round(bannerH * 0.62);
  const candidates: Rect[] = [
    { left: pad, top: pad, width: chipW, height: chipH },
    { left: bannerW - pad - chipW, top: pad, width: chipW, height: chipH },
    { left: pad, top: lowY, width: chipW, height: chipH },
    { left: bannerW - pad - chipW, top: lowY, width: chipW, height: chipH },
  ].filter((r) => r.top + r.height <= bannerH * 0.84);
  const scores = candidates.length
    ? await measureBusyness(
        bannerBytes,
        bannerW,
        bannerH,
        candidates.map((r) => ({
          left: r.left - margin,
          top: r.top - margin,
          width: r.width + margin * 2,
          height: r.height + margin * 2,
        }))
      )
    : [];
  // Take the first preferred spot that is quiet; otherwise the quietest, if quiet enough.
  let pick = scores.findIndex((v) => v <= BUSY_LIMIT);
  if (pick < 0 && scores.length) {
    const min = Math.min(...scores);
    pick = min <= BUSY_LIMIT * 1.6 ? scores.indexOf(min) : -1;
  }

  let base = Buffer.from(bannerBytes);
  let spot: Rect;
  let placed = layout;
  if (pick >= 0) {
    spot = candidates[pick];
  } else {
    // No clear spot: add a plain strip above the banner and put the logos there,
    // using the full width so many logos stay in few rows.
    const wide = await layoutLogos(logos, bannerW, bannerH, 0.92, 8, pad);
    placed = wide ?? layout;
    const strip = placed.height + pad * 2;
    base = await sharp(base)
      .extend({ top: strip, background: "#FFF8E6" })
      .png()
      .toBuffer();
    spot = { left: pad, top: pad, width: placed.width, height: placed.height };
  }

  const overlays: OverlayOptions[] = [
    { input: chipSvg(placed.width, placed.height), left: spot.left, top: spot.top },
    ...placed.items.map((item) => ({
      input: item.buf,
      left: Math.round(spot.left + item.dx),
      top: Math.round(spot.top + item.dy),
    })),
  ];

  const out = await sharp(base)
    .composite(overlays)
    .png()
    .toBuffer();
  return new Uint8Array(out);
}
