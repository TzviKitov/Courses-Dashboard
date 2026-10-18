import { Icon } from "@/components/ui/Icon";
import { parseFaq } from "@/lib/landing/parse-course-sections";
import { SpacedText } from "./SpacedText";

interface FaqAccordionProps {
  text: string;
}

const tint = {
  backgroundColor: "color-mix(in srgb, var(--primary) 8%, white)",
};

export function FaqAccordion({ text }: FaqAccordionProps) {
  const parsed = parseFaq(text);

  if (parsed.items.length === 0) {
    return <SpacedText text={text} />;
  }

  return (
    <div className="space-y-4">
      {parsed.preamble ? <SpacedText text={parsed.preamble} /> : null}
      <div className="space-y-2">
        {parsed.items.map((item, index) => (
          <details
            key={`${item.question}-${index}`}
            open={index === 0}
            className="group rounded-xl border border-gray-200 bg-white open:[border-color:color-mix(in_srgb,var(--primary)_35%,#e5e7eb)]"
          >
            <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] [&::-webkit-details-marker]:hidden [&::marker]:content-none">
              <span
                aria-hidden
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={tint}
              >
                <Icon name="help" className="text-lg text-primary" />
              </span>
              <span className="min-w-0 flex-1 font-semibold leading-snug text-gray-900">
                {item.question}
              </span>
              <span aria-hidden className="shrink-0 text-gray-400">
                <Icon
                  name="expand_more"
                  className="text-xl transition-transform group-open:rotate-180"
                />
              </span>
            </summary>
            {item.answer ? (
              <div
                className="mx-4 mb-4 rounded-xl border-s-2 px-4 py-3 text-gray-600 leading-relaxed whitespace-pre-line"
                style={{ ...tint, borderColor: "var(--primary)" }}
              >
                {item.answer}
              </div>
            ) : null}
          </details>
        ))}
      </div>
    </div>
  );
}
