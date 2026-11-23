/**
 * How much of the banner the code-drawn parts (logo strip on top, details line at
 * the bottom) can cover. The prompt asks the image model to keep faces, key
 * subjects and text out of exactly these zones, and nothing more, so the rest of
 * the image is used in full. The numbers mirror layoutLogos() and drawDetailsLine().
 */

export const LOGOS_PER_ROW = 5;

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

/** One prompt line for the zones in use, or "" when nothing is drawn over the image. */
export function reservedZonesPrompt(logoCount: number, hasDetailsLine: boolean): string {
  const top = topZonePercent(logoCount);
  const bottom = bottomZonePercent(hasDetailsLine);
  const zones: string[] = [];
  if (top > 0) zones.push(`the top ${top}% (partner logos are added there afterwards)`);
  if (bottom > 0) zones.push(`the bottom ${bottom}% (the course details line is added there afterwards)`);
  if (zones.length === 0) return "";
  return `Keep faces, heads, key subjects and text out of ${zones.join(" and ")}. The scene itself continues to the edge there: do not leave empty bands.`;
}
