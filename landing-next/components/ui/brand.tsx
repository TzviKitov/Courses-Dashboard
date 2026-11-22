import type { CSSProperties, ReactNode } from "react";
import { FadeImage } from "@/components/ui/FadeImage";

export function audienceColors(tag: string): CSSProperties {
  if (tag === "youth") {
    return { background: "var(--audience-youth)", color: "var(--audience-youth-on)" };
  }
  if (tag === "young_adults") {
    return { background: "var(--audience-young)", color: "var(--audience-young-on)" };
  }
  return { background: "var(--color-surface-2)", color: "var(--color-text)" };
}

export function audienceTint(tags: string[]): CSSProperties {
  if (tags.includes("young_adults") && !tags.includes("youth")) {
    return { background: "var(--audience-young-tint)", color: "var(--audience-young)" };
  }
  if (tags.includes("youth")) {
    return { background: "var(--audience-youth-tint)", color: "var(--audience-youth)" };
  }
  return { background: "var(--color-surface-2)", color: "var(--color-text-muted)" };
}

export function sectorColors(sector: string): CSSProperties {
  if (sector === "haredi") {
    return { background: "var(--sector-haredi)", color: "var(--sector-haredi-on)" };
  }
  if (sector === "east_jerusalem") {
    return { background: "var(--sector-east-jerusalem)", color: "var(--sector-east-jerusalem-on)" };
  }
  if (sector === "general") {
    return { background: "var(--sector-general)", color: "var(--sector-general-on)" };
  }
  return { background: "var(--color-surface-2)", color: "var(--color-text)" };
}

export function ArchMedia({
  src,
  alt,
  tint,
  priority,
  children,
}: {
  src?: string | null;
  alt: string;
  tint: CSSProperties;
  priority?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="av-arch" style={tint}>
      <div className="av-arch-media">
        {src ? (
          <FadeImage src={src} alt={alt} priority={priority} sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 25vw" className="object-cover" />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold">ללא תמונה</span>
        )}
      </div>
      {children}
    </div>
  );
}

export function WallDivider() {
  return <div className="av-wall" role="presentation" />;
}
