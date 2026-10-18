interface SpacedTextProps {
  text: string;
}

export function SpacedText({ text }: SpacedTextProps) {
  const paragraphs = text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) return null;

  return (
    <div className="space-y-4">
      {paragraphs.map((paragraph, index) => (
        <p
          key={`${index}-${paragraph.slice(0, 24)}`}
          className="text-gray-600 leading-relaxed whitespace-pre-line"
        >
          {paragraph}
        </p>
      ))}
    </div>
  );
}
