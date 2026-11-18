import { parseSyllabus } from "@/lib/landing/parse-course-sections";
import { SpacedText } from "./SpacedText";

interface SyllabusTimelineProps {
  text: string;
}

const BULLET = /^[•●▪◦]\s+(.+)$|^(?:[-*–])\s+(.+)$/;

function splitStepBody(body: string): {
  prose: string;
  bullets: string[];
  result: string;
} {
  const lines = body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const resultAt = lines.findIndex((line) => /^התוצאה\s*:/.test(line));
  const main = resultAt === -1 ? lines : lines.slice(0, resultAt);
  const result = resultAt === -1 ? "" : lines.slice(resultAt).join(" ");
  const bulletLines = main
    .map((line) => line.match(BULLET))
    .filter((match): match is RegExpMatchArray => Boolean(match));

  if (main.length > 0 && bulletLines.length === main.length) {
    return {
      prose: "",
      bullets: bulletLines.map((match) => (match[1] || match[2] || "").trim()),
      result,
    };
  }

  return { prose: main.join("\n"), bullets: [], result };
}

export function SyllabusTimeline({ text }: SyllabusTimelineProps) {
  const parsed = parseSyllabus(text);

  if (parsed.steps.length === 0) {
    return <SpacedText text={text} />;
  }

  return (
    <div className="space-y-5">
      {parsed.intro ? <SpacedText text={parsed.intro} /> : null}
      <ol className="m-0 grid list-none gap-3 p-0">
        {parsed.steps.map((step, index) => {
          const content = splitStepBody(step.body);
          return (
            <li
              key={`${step.title}-${index}`}
              className="rounded-2xl p-5"
              style={{
                background: "var(--color-bg)",
                border: "1px solid color-mix(in srgb, var(--primary) 14%, var(--color-border))",
              }}
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-extrabold"
                  style={{
                    backgroundColor: "var(--primary)",
                    color: "var(--primary-contrast)",
                  }}
                >
                  {index + 1}
                </span>
                <p className="min-w-0 font-bold text-[var(--color-text)]">{step.title}</p>
              </div>
              {content.prose ? (
                <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-muted)] whitespace-pre-line">
                  {content.prose}
                </p>
              ) : null}
              {content.bullets.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {content.bullets.map((item, itemIndex) => (
                    <li
                      key={`${itemIndex}-${item}`}
                      className="flex items-start gap-2 text-sm leading-relaxed text-[var(--color-text-muted)]"
                    >
                      <span
                        aria-hidden
                        className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: "var(--primary)" }}
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {content.result ? (
                <p
                  className="mt-4 rounded-lg px-3 py-2.5 text-sm font-semibold leading-relaxed"
                  style={{
                    color: "var(--color-text)",
                    background: "color-mix(in srgb, var(--primary) 12%, var(--color-surface))",
                  }}
                >
                  {content.result}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
