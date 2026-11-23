/**
 * Gallery visibility rules for a course.
 * Hidden courses and courses for guides stay reachable by their direct link
 * but never appear in the public gallery.
 */

/** Audience categories that must never be listed in the public gallery. */
export const NON_GALLERY_AUDIENCES = ["guides"] as const;

export function isNonGalleryAudience(category: unknown): boolean {
  return (
    typeof category === "string" &&
    (NON_GALLERY_AUDIENCES as readonly string[]).includes(category)
  );
}

/** Value for `landings.is_public` when a course is created. */
export function resolveIsPublic(input: {
  hidden?: unknown;
  audienceCategory?: unknown;
}): boolean {
  if (input.hidden === true) return false;
  if (isNonGalleryAudience(input.audienceCategory)) return false;
  return true;
}

/** Same rule for a stored course (used by the local JSON fallback listing). */
export function isListedInGallery(input: {
  isPublic?: boolean | null;
  audienceCategory?: unknown;
}): boolean {
  if (input.isPublic === false) return false;
  return !isNonGalleryAudience(input.audienceCategory);
}
