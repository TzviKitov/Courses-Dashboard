import { parseAbout } from "@/lib/landing/parse-course-sections";

interface AboutBlocksProps {
  text: string;
}

export function AboutBlocks({ text }: AboutBlocksProps) {
  const blocks = parseAbout(text);
  if (blocks.length === 0) return null;

  return (
    <div className="space-y-5">
      {blocks.map((block, index) => {
        if (block.kind === "heading") {
          return (
            <h3
              key={`heading-${index}`}
              className="text-base font-bold text-[var(--color-text)]"
            >
              {block.text}
            </h3>
          );
        }

        if (block.kind === "bullets") {
          return (
            <ul
              key={`bullets-${index}`}
              className="m-0 grid list-none grid-cols-1 gap-x-8 gap-y-2.5 p-0 sm:grid-cols-2"
            >
              {block.items.map((item, itemIndex) => (
                <li
                  key={`${itemIndex}-${item}`}
                  className="flex items-start gap-2.5 text-[var(--color-text)] leading-relaxed"
                >
                  <span
                    aria-hidden
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: "var(--primary)" }}
                  />
                  <span className="min-w-0">{item}</span>
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p
            key={`paragraph-${index}`}
            className="leading-relaxed text-[var(--color-text-muted)] whitespace-pre-line"
          >
            {block.text}
          </p>
        );
      })}
    </div>
  );
}
