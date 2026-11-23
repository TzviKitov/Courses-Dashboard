/**
 * How much of the banner the code-drawn parts (logo strip on top, details line at
 * the bottom) can cover. The prompt asks the image model to keep faces, key
 * subjects and text out of exactly these zones, and nothing more, so the rest of
 * the image is used in full. The numbers mirror layoutLogos() and drawDetailsLine().
 */

/** Logos per row in the strip; up to this many fit in one single-row strip. */
export const LOGOS_PER_ROW = 8;

/** Height of the details pill plus its bottom margin, as a share of the banner (drawDetailsLine). */
const DETAILS_ZONE_PCT = 13;

/** Per-row logo height as a share of the banner, by number of rows (layoutLogos). */
function rowFraction(rows: number): number {
  return rows === 1 ? 0.055 : rows === 2 ? 0.048 : 0.042;
}

/** Share of the banner height (percent, rounded up) the logo strip can reach from the top edge. */
export function topZonePercent(logoCount: number): number {
  if (logoCount <= 0) return 0;
  const rows = Math.ceil(logoCount / LOGOS_PER_ROW);
  const pad = 0.02; // edge offset
  const chipPad = 0.009 * 2; // padding inside the strip, both sides
  const gaps = (rows - 1) * 0.014;
  const fraction = pad + rows * rowFraction(rows) + gaps + chipPad;
  return Math.ceil(fraction * 100) + 1;
}

/** Share of the banner height (percent) the details line can reach from the bottom edge. */
export function bottomZonePercent(hasDetailsLine: boolean): number {
  return hasDetailsLine ? DETAILS_ZONE_PCT : 0;
}

/**
 * One prompt line for the zones in use, or "" when nothing is drawn over the image.
 * Phrased as a composition range (what to do) rather than a list of things to avoid.
 */
export function reservedZonesPrompt(logoCount: number, hasDetailsLine: boolean): string {
  const top = topZonePercent(logoCount);
  const bottom = bottomZonePercent(hasDetailsLine);
  if (top === 0 && bottom === 0) return "";
  const range =
    top > 0 && bottom > 0
      ? `between ${top}% and ${100 - bottom}% of the image height`
      : top > 0
        ? `below the top ${top}% of the image height`
        : `above the bottom ${bottom}% of the image height`;
  const parts: string[] = [];
  if (top > 0) parts.push(`the top ${top}% (partner logos are added there afterwards)`);
  if (bottom > 0) parts.push(`the bottom ${bottom}% (the course details line is added there afterwards)`);
  return `Compose all people, objects and text ${range}. Only plain background (sky, wall, floor, texture) continues into ${parts.join(" and ")}, so the scene still reaches the edge.`;
}
