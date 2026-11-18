import type { ReactNode } from "react";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { AboutBlocks } from "./AboutBlocks";
import { DetailItem } from "./DetailItem";
import { FaqAccordion } from "./FaqAccordion";
import { SyllabusTimeline } from "./SyllabusTimeline";
import type { LandingPageData } from "@/types/landing";
import {
  COURSE_TYPE_OPTIONS,
  GENDER_SEPARATION_OPTIONS,
  SECTOR_OPTIONS,
} from "@/types/course";

interface CourseDetailsProps {
  course: LandingPageData["course"];
  partnerLogos?: LandingPageData["assets"]["partnerLogos"];
}

function scheduleDatesLabel(course: LandingPageData["course"]): string | undefined {
  if (course.schedule.dates) return course.schedule.dates;
  const start = course.schedule.startDate || "";
  const end = course.schedule.endDate || "";
  if (start && end) return `${start} - ${end}`;
  return start || end || undefined;
}

export function CourseDetails({ course, partnerLogos }: CourseDetailsProps) {
  const sectorLabel =
    course.sector && course.sector !== "general"
      ? SECTOR_OPTIONS.find((o) => o.value === course.sector)?.label
      : undefined;
  const genderLabel =
    course.genderSeparation && course.genderSeparation !== "everyone"
      ? GENDER_SEPARATION_OPTIONS.find((o) => o.value === course.genderSeparation)
          ?.label
      : undefined;
  const courseTypeLabel = course.courseType
    ? COURSE_TYPE_OPTIONS.find((o) => o.value === course.courseType)?.label
    : undefined;

  const details = [
    { icon: "calendar_month", label: "תאריכים", value: scheduleDatesLabel(course) },
    { icon: "schedule", label: "שעות", value: course.schedule.time },
    { icon: "event_repeat", label: "ימים", value: course.schedule.days },
    { icon: "location_on", label: "מיקום", value: course.location },
    { icon: "hourglass_top", label: "משך הקורס", value: course.duration },
    { icon: "group", label: "קהל יעד", value: course.targetAudience },
    { icon: "cake", label: "טווח גילאים", value: course.ageRange },
    { icon: "diversity_3", label: "מגזר", value: sectorLabel },
    { icon: "wc", label: "הפרדה מגדרית", value: genderLabel },
    { icon: "category", label: "סוג קורס", value: courseTypeLabel },
    { icon: "call", label: "לפרטים נוספים", value: course.contactPhone },
  ].filter((d) => d.value); // Only show items with values

  const logos = partnerLogos?.filter((l) => l.url) || [];

  return (
    <div className="lg:col-span-2 space-y-8">
      {course.extendedDescription && (
        <SectionFrame title="על הקורס">
          <AboutBlocks text={course.extendedDescription} />
        </SectionFrame>
      )}

      {course.syllabusText && (
        <SectionFrame title="סילבוס / שלבי התכנית">
          <SyllabusTimeline text={course.syllabusText} />
        </SectionFrame>
      )}

      {course.faqText && (
        <SectionFrame title="שאלות נפוצות">
          <FaqAccordion text={course.faqText} />
        </SectionFrame>
      )}

      {details.length > 0 && (
        <SectionFrame title="פרטי הקורס">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {details.map((detail) => (
              <DetailItem
                key={detail.icon}
                icon={detail.icon}
                label={detail.label}
                value={detail.value!}
              />
            ))}
          </div>
        </SectionFrame>
      )}

      {logos.length > 0 && (
        <SectionFrame title="שותפים">
          <div className="flex flex-wrap items-center gap-6">
            {logos.map((logo) => (
              <OptimizedImage
                key={logo.id}
                src={logo.url}
                alt={logo.name}
                width={140}
                height={48}
                className="h-12 w-auto max-w-[140px] object-contain"
              />
            ))}
          </div>
        </SectionFrame>
      )}
    </div>
  );
}

function SectionFrame({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      className="rounded-2xl p-6 md:p-8"
      style={{
        background: "var(--color-surface)",
        border: "1px solid color-mix(in srgb, var(--primary) 16%, var(--color-border))",
      }}
    >
      <div className="mb-5">
        <span
          aria-hidden
          className="mb-3 block h-1 w-10 rounded-full"
          style={{ background: "var(--primary)" }}
        />
        <h2 className="text-2xl font-extrabold text-[var(--color-text)]">{title}</h2>
      </div>
      {children}
    </section>
  );
}
