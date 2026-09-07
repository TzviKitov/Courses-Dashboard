import sharp from "sharp";

const MAX_LOGOS = 4;

/**
 * Overlay actual logo images onto a generated banner.
 * Gemini often draws labeled placeholder boxes instead of using reference
 * images; compositing after generation keeps the real marks.
 *
 * Placement (RTL-friendly corners, away from typical Hebrew headline):
 * 1. bottom-right  2. top-left  3. bottom-left  4. top-left row, beside #2
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

  const maxH = Math.max(28, Math.round(bannerH * 0.12));
  const maxW = Math.max(28, Math.round(bannerW * 0.18));
  const pad = Math.max(16, Math.round(Math.min(bannerW, bannerH) * 0.035));
  const gap = Math.max(10, Math.round(pad * 0.55));

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

  let topLeftWidth = 0;
  const overlays = prepared.map((logo, index) => {
    let left = pad;
    let top = pad;
    if (index === 0) {
      left = bannerW - pad - logo.width;
      top = bannerH - pad - logo.height;
    } else if (index === 1) {
      left = pad;
      top = pad;
      topLeftWidth = logo.width;
    } else if (index === 2) {
      left = pad;
      top = bannerH - pad - logo.height;
    } else {
      left = pad + topLeftWidth + gap;
      top = pad;
      if (left + logo.width > bannerW - pad) {
        left = bannerW - pad - logo.width;
      }
    }
    return {
      input: logo.buf,
      left: Math.max(0, Math.round(left)),
      top: Math.max(0, Math.round(top)),
    };
  });

  const out = await sharp(Buffer.from(bannerBytes))
    .composite(overlays)
    .png()
    .toBuffer();
  return new Uint8Array(out);
}
