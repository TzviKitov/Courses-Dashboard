/**
 * Normalize and validate Israeli mobile numbers for SMS OTP.
 * Accepts: 05XXXXXXXX, 5XXXXXXXX, +9725XXXXXXXX, 9725XXXXXXXX
 */

export function normalizeIsraeliPhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, "").replace(/^\+/, "");
  let national = digits;
  if (national.startsWith("972")) {
    national = national.slice(3);
  }
  if (national.startsWith("0")) {
    national = national.slice(1);
  }
  // Mobile: 5XXXXXXXX (9 digits after country code)
  if (!/^5\d{8}$/.test(national)) {
    return null;
  }
  return `+972${national}`;
}

export function isIsraeliMobile(input: string): boolean {
  return normalizeIsraeliPhone(input) !== null;
}

/**
 * Global SMS expects local Israeli format, e.g. 0522123456.
 */
export function toIsraeliLocalPhone(input: string): string | null {
  const e164 = normalizeIsraeliPhone(input);
  if (!e164) return null;
  return `0${e164.slice(4)}`; // +9725XXXXXXXX → 05XXXXXXXX
}
