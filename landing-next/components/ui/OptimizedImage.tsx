import Image from "next/image";

export function canOptimizeImageSrc(src: string): boolean {
  if (!src || src.startsWith("blob:") || src.startsWith("data:")) return false;
  if (/\.svg(\?|#|$)/i.test(src)) return false;
  try {
    const url = new URL(src, "http://localhost");
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

type OptimizedImageProps = {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
} & (
  | { fill: true; width?: never; height?: never }
  | { fill?: false; width: number; height: number }
);

/** next/image for remote/local photos; plain img for blob, data, and SVG. */
export function OptimizedImage({
  src,
  alt,
  className,
  sizes,
  priority,
  fill,
  ...dims
}: OptimizedImageProps) {
  if (!canOptimizeImageSrc(src)) {
    if (fill) {
      return (
        // eslint-disable-next-line @next/next/no-img-element -- blob/data/SVG cannot use the optimizer
        <img src={src} alt={alt} className={`absolute inset-0 h-full w-full ${className ?? ""}`} />
      );
    }

    const { width, height } = dims as { width: number; height: number };
    return (
      // eslint-disable-next-line @next/next/no-img-element -- blob/data/SVG cannot use the optimizer
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={className}
      />
    );
  }

  if (fill) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes ?? "100vw"}
        priority={priority}
        className={className}
      />
    );
  }

  const { width, height } = dims as { width: number; height: number };
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      priority={priority}
      className={className}
    />
  );
}
