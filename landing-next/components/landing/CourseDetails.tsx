import { DetailItem } from "./DetailItem";
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
      {/* Extended Description */}
      {course.extendedDescription && (
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">על הקורס</h2>
          <div className="text-gray-600 leading-relaxed whitespace-pre-line">
            {course.extendedDescription}
          </div>
        </div>
      )}

      {/* Syllabus */}
      {course.syllabusText && (
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            סילבוס / שלבי התכנית
          </h2>
          <div className="text-gray-600 leading-relaxed whitespace-pre-line">
            {course.syllabusText}
          </div>
        </div>
      )}

      {/* FAQ */}
      {course.faqText && (
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">שאלות נפוצות</h2>
          <div className="text-gray-600 leading-relaxed whitespace-pre-line">
            {course.faqText}
          </div>
        </div>
      )}

      {/* Course Details Grid */}
      {details.length > 0 && (
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">פרטי הקורס</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {details.map((detail) => (
              <DetailItem
                key={detail.icon}
                icon={detail.icon}
                label={detail.label}
                value={detail.value!}
              />
            ))}
          </div>
        </div>
      )}

      {/* Partner logos */}
      {logos.length > 0 && (
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">שותפים</h2>
          <div className="flex flex-wrap items-center gap-6">
            {logos.map((logo) => (
              <img
                key={logo.id}
                src={logo.url}
                alt={logo.name}
                className="h-12 w-auto max-w-[140px] object-contain"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
