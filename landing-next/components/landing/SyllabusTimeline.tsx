import { parseSyllabus } from "@/lib/landing/parse-course-sections";
import { SpacedText } from "./SpacedText";

interface SyllabusTimelineProps {
  text: string;
}

export function SyllabusTimeline({ text }: SyllabusTimelineProps) {
  const parsed = parseSyllabus(text);

  if (parsed.steps.length === 0) {
    return <SpacedText text={text} />;
  }

  return (
    <div className="space-y-6">
      {parsed.intro ? <SpacedText text={parsed.intro} /> : null}
      <ol className="m-0 list-none p-0">
        {parsed.steps.map((step, index) => {
          const isLast = index === parsed.steps.length - 1;
          return (
            <li key={`${step.title}-${index}`} className="relative flex gap-4">
              {!isLast ? (
                <span
                  aria-hidden
                  className="absolute top-10 bottom-0 w-px"
                  style={{
                    insetInlineStart: "calc(1.25rem - 0.5px)",
                    backgroundColor:
                      "color-mix(in srgb, var(--primary) 40%, #e5e7eb)",
                  }}
                />
              ) : null}
              <span
                aria-hidden
                className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                style={{
                  backgroundColor: "var(--primary)",
                  color: "var(--primary-contrast)",
                }}
              >
                {index + 1}
              </span>
              <div className={`min-w-0 flex-1 pt-1.5 ${isLast ? "" : "pb-6"}`}>
                <p className="font-semibold text-gray-900">{step.title}</p>
                {step.body ? (
                  <p className="mt-1 text-gray-600 leading-relaxed whitespace-pre-line">
                    {step.body}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
