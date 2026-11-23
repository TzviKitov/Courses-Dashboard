import sharp from "sharp";

const MAX_LOGOS = 4;

/**
 * Overlay actual logo images onto a generated banner.
 * Gemini often draws labeled placeholder boxes instead of using reference
 * images; compositing after generation keeps the real marks.
 *
 * Placement: all logos in one row, top-left, on a small light chip (first logo
 * is the municipality). This keeps clear of the bottom date strip and the
 * right-aligned Hebrew headline.
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

  const overlays: sharp.OverlayOptions[] = [
    { input: chip, left: pad, top: pad },
  ];
  let x = pad + chipPad;
  for (const logo of prepared) {
    overlays.push({
      input: logo.buf,
      left: Math.round(x),
      top: Math.round(pad + chipPad + (rowH - logo.height) / 2),
    });
    x += logo.width + gap;
  }

  const out = await sharp(Buffer.from(bannerBytes))
    .composite(overlays)
    .png()
    .toBuffer();
  return new Uint8Array(out);
}
