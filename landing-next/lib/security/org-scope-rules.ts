/** When both sides have an org, they must match. Null skips (legacy rows). */
export function organizationsCompatible(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  if (!a || !b) return true;
  return a === b;
}
