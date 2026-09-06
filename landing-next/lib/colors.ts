/**
 * Color utility functions for theme management
 */

/**
 * Darken or lighten a hex color by a percentage
 * @param hex - Hex color string (e.g., "#13ecda")
 * @param percent - Negative to darken, positive to lighten
 * @returns Modified hex color
 */
export function adjustColor(hex: string, percent: number): string {
  // Remove # if present and ensure valid hex
  const cleanHex = hex.replace('#', '');
  if (!/^[0-9A-Fa-f]{6}$/.test(cleanHex)) {
    return hex;
  }

  const num = parseInt(cleanHex, 16);
  const amt = Math.round(2.55 * percent);

  const R = Math.max(0, Math.min(255, (num >> 16) + amt));
  const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amt));
  const B = Math.max(0, Math.min(255, (num & 0x0000ff) + amt));

  return `#${((1 << 24) | (R << 16) | (G << 8) | B).toString(16).slice(1)}`;
}

/**
 * Calculate contrasting text color (black or white) for a given background
 * @param hex - Background hex color
 * @returns Black or white hex color for optimal contrast
 */
export function getContrastColor(hex: string): string {
  const background = normalizeHex(hex, "#5b21b6");
  const dark = "#0f172a";
  const light = "#ffffff";
  const darkRatio = getContrastRatio(background, dark);
  const lightRatio = getContrastRatio(background, light);

  if (darkRatio >= 4.5 && darkRatio >= lightRatio) return dark;
  if (lightRatio >= 4.5) return light;
  return "#000000";
}

function relativeLuminance(hex: string): number {
  const normalized = normalizeHex(hex, "#000000").slice(1);
  const channels = [0, 2, 4].map((index) => {
    const value = parseInt(normalized.slice(index, index + 2), 16) / 255;
    return value <= 0.04045
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** Calculate a WCAG contrast ratio between two hexadecimal colors. */
export function getContrastRatio(first: string, second: string): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Produce a hover color that preserves AA contrast with the chosen foreground.
 * Light accents are lightened when paired with dark text; dark accents are
 * darkened slightly when paired with white text.
 */
export function getAccessibleHoverColor(
  background: string,
  foreground: string,
  minimumRatio = 4.5
): string {
  const normalized = normalizeHex(background, "#5b21b6");
  const direction = foreground.toLowerCase() === "#ffffff" ? -7 : 7;
  let candidate = adjustColor(normalized, direction);

  for (let step = 0; step < 8; step += 1) {
    if (getContrastRatio(candidate, foreground) >= minimumRatio) {
      return candidate;
    }
    candidate = adjustColor(candidate, direction);
  }

  return normalized;
}

/**
 * Validate and normalize a hex color
 * @param hex - Hex color string
 * @param fallback - Fallback color if invalid
 * @returns Valid hex color
 */
export function normalizeHex(hex: string | undefined, fallback: string): string {
  if (!hex) return fallback;

  const cleanHex = hex.replace('#', '');
  if (/^[0-9A-Fa-f]{6}$/.test(cleanHex)) {
    return `#${cleanHex.toLowerCase()}`;
  }
  if (/^[0-9A-Fa-f]{3}$/.test(cleanHex)) {
    // Expand 3-digit hex to 6-digit
    const expanded = cleanHex
      .split('')
      .map((c) => c + c)
      .join('');
    return `#${expanded.toLowerCase()}`;
  }

  return fallback;
}
