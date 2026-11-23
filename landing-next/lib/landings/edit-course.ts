import { formatScheduleDates } from "../../types/course";
import { resolveIsPublic } from "./visibility";

/** Fields a guide can change after the course was created. */
export interface CourseEdits {
  title?: unknown;
  description?: unknown;
  extendedDescription?: unknown;
  faqText?: unknown;
  syllabusText?: unknown;
  location?: unknown;
  duration?: unknown;
  ageRange?: unknown;
  instructorName?: unknown;
  organization?: unknown;
  role?: unknown;
  contactPhone?: unknown;
  contactEmail?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  interviewDate?: unknown;
  time?: unknown;
  days?: unknown;
  price?: unknown;
  paymentLink?: unknown;
  requiresInterview?: unknown;
  hidden?: unknown;
}

type Json = Record<string, unknown>;

export interface EditResult {
  course: Json;
  form: Json;
  columns: {
    start_date: string | null;
    end_date: string | null;
    price: number | null;
    is_public: boolean;
  };
}

export type EditOutcome = { ok: true; value: EditResult } | { ok: false; error: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const SHORT = 200;
const LONG = 6000;

function text(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.trim().slice(0, max);
}

function isoDate(value: unknown): string | null | "invalid" {
  if (typeof value !== "string") return "invalid";
  const v = value.trim();
  if (!v) return null;
  if (!ISO_DATE.test(v)) return "invalid";
  const [y, m, d] = v.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
    ? v
    : "invalid";
}

/** "" removes an optional field so the landing page hides its row. */
function setOptional(target: Json, key: string, value: string | undefined) {
  if (value === undefined) return;
  if (value === "") delete target[key];
  else target[key] = value;
}

/**
 * Merge edits into the stored course/form. Unknown stored fields (banner data,
 * sector, course type...) are kept as they are. Returns the new JSON plus the
 * denormalized columns (start/end date, price, is_public) that must stay in sync.
 */
export function applyCourseEdits(
  existing: { course: Json; form: Json; isPublic: boolean; price: number | null; startDate: string | null; endDate: string | null },
  edits: CourseEdits
): EditOutcome {
  const course: Json = { ...existing.course };
  const form: Json = { ...existing.form };
  const prevSchedule = (existing.course.schedule ?? {}) as Json;
  const schedule: Json = { ...prevSchedule };

  if (edits.title !== undefined) {
    const title = text(edits.title, 120);
    if (!title) return { ok: false, error: "חסרה כותרת לקורס" };
    course.title = title;
  }
  const description = text(edits.description, 600);
  if (description !== undefined) course.description = description;

  setOptional(course, "extendedDescription", text(edits.extendedDescription, LONG));
  setOptional(course, "faqText", text(edits.faqText, LONG));
  setOptional(course, "syllabusText", text(edits.syllabusText, LONG));
  setOptional(course, "location", text(edits.location, SHORT));
  setOptional(course, "duration", text(edits.duration, SHORT));
  setOptional(course, "ageRange", text(edits.ageRange, SHORT));
  setOptional(course, "instructorName", text(edits.instructorName, SHORT));
  setOptional(course, "organization", text(edits.organization, SHORT));
  setOptional(course, "role", text(edits.role, SHORT));
  setOptional(course, "contactPhone", text(edits.contactPhone, 40));
  setOptional(course, "contactEmail", text(edits.contactEmail, 254));

  let startDate = existing.startDate;
  let endDate = existing.endDate;

  if (edits.startDate !== undefined) {
    const d = isoDate(edits.startDate);
    if (d === "invalid") return { ok: false, error: "תאריך פתיחה לא תקין" };
    startDate = d;
    setOptional(schedule, "startDate", d ?? "");
  }
  if (edits.endDate !== undefined) {
    const d = isoDate(edits.endDate);
    if (d === "invalid") return { ok: false, error: "תאריך סיום לא תקין" };
    endDate = d;
    setOptional(schedule, "endDate", d ?? "");
  }
  if (edits.interviewDate !== undefined) {
    const d = isoDate(edits.interviewDate);
    if (d === "invalid") return { ok: false, error: "תאריך ראיון לא תקין" };
    setOptional(schedule, "interviewDate", d ?? "");
  }
  if (startDate && endDate && startDate > endDate) {
    return { ok: false, error: "תאריך הסיום לפני תאריך הפתיחה" };
  }
  setOptional(schedule, "time", text(edits.time, 60));
  setOptional(schedule, "days", text(edits.days, SHORT));

  const dates = formatScheduleDates(startDate ?? "", endDate ?? "");
  if (dates) schedule.dates = dates;
  else delete schedule.dates;
  course.schedule = schedule;

  let price = existing.price;
  if (edits.price !== undefined) {
    if (edits.price === null || edits.price === "") {
      price = null;
    } else {
      const n = typeof edits.price === "number" ? edits.price : Number(edits.price);
      if (!Number.isFinite(n) || n < 0 || n > 100000) {
        return { ok: false, error: "מחיר לא תקין" };
      }
      price = n;
    }
  }

  if (edits.paymentLink !== undefined) {
    const link = text(edits.paymentLink, 500) ?? "";
    if (link && !/^https?:\/\/[^\s]+$/i.test(link)) {
      return { ok: false, error: "לינק התשלום חייב להתחיל ב-https://" };
    }
    if (link) form.paymentLink = link;
    else delete form.paymentLink;
  }
  if (typeof edits.requiresInterview === "boolean") {
    form.requiresInterview = edits.requiresInterview;
  }

  // Hidden courses and courses for guides never show in the gallery.
  const wantsHidden =
    typeof edits.hidden === "boolean" ? edits.hidden : !existing.isPublic;
  const isPublic = resolveIsPublic({
    hidden: wantsHidden,
    audienceCategory: course.audienceCategory,
  });

  return {
    ok: true,
    value: {
      course,
      form,
      columns: { start_date: startDate, end_date: endDate, price, is_public: isPublic },
    },
  };
}
