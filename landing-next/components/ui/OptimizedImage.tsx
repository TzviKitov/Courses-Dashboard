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
  onLoad?: (event: React.SyntheticEvent<HTMLImageElement>) => void;
} & (
  | { fill: true; width?: never; height?: never }
  | { fill?: false; width: number; height: number }
);

/** Only schemes that can show an image; blocks javascript: and similar. */
function safeImgSrc(src: string): string {
  let url: URL;
  try {
    url = new URL(src, "https://placeholder.invalid");
  } catch {
    return "";
  }
  const isImageData =
    url.protocol === "data:" && src.slice(0, 11).toLowerCase() === "data:image/";
  const allowed =
    url.protocol === "https:" ||
    url.protocol === "http:" ||
    url.protocol === "blob:" ||
    isImageData;
  if (!allowed) return "";
  // Relative paths were resolved against a dummy origin: keep only the path part.
  if (url.origin === "https://placeholder.invalid") {
    return `${url.pathname}${url.search}${url.hash}`;
  }
  return url.href;
}

/** next/image for remote/local photos; plain img for blob, data, and SVG. */
export function OptimizedImage({
  src,
  alt,
  className,
  sizes,
  priority,
  onLoad,
  fill,
  ...dims
}: OptimizedImageProps) {
  if (!canOptimizeImageSrc(src)) {
    if (fill) {
      return (
        // eslint-disable-next-line @next/next/no-img-element -- blob/data/SVG cannot use the optimizer
        <img src={safeImgSrc(src)} alt={alt} className={`absolute inset-0 h-full w-full ${className ?? ""}`} />
      );
    }

    const { width, height } = dims as { width: number; height: number };
    return (
      // eslint-disable-next-line @next/next/no-img-element -- blob/data/SVG cannot use the optimizer
      <img
        src={safeImgSrc(src)}
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
        onLoad={onLoad}
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
