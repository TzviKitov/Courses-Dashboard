import { Icon } from "@/components/ui/Icon";
import { parseFaq } from "@/lib/landing/parse-course-sections";
import { SpacedText } from "./SpacedText";

interface FaqAccordionProps {
  text: string;
}

const rowBorder = "color-mix(in srgb, var(--primary) 16%, var(--color-border))";

export function FaqAccordion({ text }: FaqAccordionProps) {
  const parsed = parseFaq(text);

  if (parsed.items.length === 0) {
    return <SpacedText text={text} />;
  }

  return (
    <div className="space-y-5">
      {parsed.preamble ? <SpacedText text={parsed.preamble} /> : null}
      <div className="space-y-3">
        {parsed.items.map((item, index) => (
          <details
            key={`${item.question}-${index}`}
            className="group rounded-xl bg-[var(--color-surface)] px-5 open:[border-color:color-mix(in_srgb,var(--primary)_40%,var(--color-border))]"
            style={{ border: `1px solid ${rowBorder}` }}
          >
            <summary className="flex cursor-pointer list-none items-center gap-4 py-4 outline-none [&::-webkit-details-marker]:hidden [&::marker]:content-none">
              <span className="min-w-0 flex-1 font-semibold leading-snug text-[var(--color-text)]">
                {item.question}
              </span>
              <span
                aria-hidden
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--color-text-muted)]"
                style={{ background: "color-mix(in srgb, var(--primary) 10%, var(--color-surface))" }}
              >
                <Icon
                  name="expand_more"
                  className="text-xl transition-transform duration-200 group-open:rotate-180"
                />
              </span>
            </summary>
            {item.answer ? (
              <div className="pb-5 text-sm leading-relaxed text-[var(--color-text-muted)] whitespace-pre-line">
                {item.answer}
              </div>
            ) : null}
          </details>
        ))}
      </div>
    </div>
  );
}
