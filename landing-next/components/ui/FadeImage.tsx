"use client";

import { useEffect, useRef } from "react";
import { OptimizedImage } from "@/components/ui/OptimizedImage";

interface FadeImageProps {
  src: string;
  alt: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
}

/**
 * Fill image that fades in once it has loaded, over the tint behind it, instead of popping in.
 * The "is-loaded" class is set straight on the element (no React state), including for cached
 * images that finished before hydration. A CSS fallback (polish.css) shows the image after
 * 1.5s even if script never runs.
 */
export function FadeImage({ src, alt, sizes, priority, className }: FadeImageProps) {
  const wrap = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const img = wrap.current?.querySelector("img");
    if (img && img.complete && img.naturalWidth > 0) img.classList.add("is-loaded");
  }, [src]);

  return (
    <span ref={wrap} className="av-fade-wrap">
      <OptimizedImage
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        onLoad={(event) => event.currentTarget.classList.add("is-loaded")}
        className={`av-fade-img${className ? ` ${className}` : ""}`}
      />
    </span>
  );
}
