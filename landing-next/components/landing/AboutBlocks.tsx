import { Icon } from "@/components/ui/Icon";
import { parseAbout } from "@/lib/landing/parse-course-sections";

interface AboutBlocksProps {
  text: string;
}

const tileStyle = {
  borderColor: "color-mix(in srgb, var(--primary) 22%, #e5e7eb)",
  backgroundColor: "color-mix(in srgb, var(--primary) 8%, white)",
};

export function AboutBlocks({ text }: AboutBlocksProps) {
  const blocks = parseAbout(text);
  if (blocks.length === 0) return null;

  return (
    <div className="space-y-4">
      {blocks.map((block, index) => {
        if (block.kind === "heading") {
          return (
            <div key={`heading-${index}`} className="flex items-center gap-2">
              <span
                aria-hidden
                className="h-4 w-1 shrink-0 rounded-full"
                style={{ backgroundColor: "var(--primary)" }}
              />
              <h3 className="text-base font-semibold text-gray-900">
                {block.text}
              </h3>
            </div>
          );
        }

        if (block.kind === "bullets") {
          return (
            <ul
              key={`bullets-${index}`}
              className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2"
            >
              {block.items.map((item, itemIndex) => (
                <li
                  key={`${itemIndex}-${item}`}
                  className="flex items-start gap-3 rounded-xl border px-4 py-3"
                  style={tileStyle}
                >
                  <span
                    aria-hidden
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: "var(--primary)",
                      color: "var(--primary-contrast)",
                    }}
                  >
                    <Icon name="check" className="text-sm" />
                  </span>
                  <span className="min-w-0 text-gray-800 leading-relaxed">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p
            key={`paragraph-${index}`}
            className="text-gray-600 leading-relaxed whitespace-pre-line"
          >
            {block.text}
          </p>
        );
      })}
    </div>
  );
}
