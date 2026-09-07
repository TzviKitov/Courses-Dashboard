import { OptimizedImage } from "@/components/ui/OptimizedImage";

interface HeroProps {
  title: string;
  description: string;
  backgroundUrl?: string;
}

export function Hero({ title, description, backgroundUrl }: HeroProps) {
  return (
    <section className="relative h-[48vh] min-h-[360px] max-h-[640px] overflow-hidden">
      {/* Background image or gradient fallback */}
      {backgroundUrl ? (
        <OptimizedImage
          src={backgroundUrl}
          alt={`תמונת הקורס ${title}`}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-900" />
      )}

      {/* Dark overlay */}
      <div className="hero-overlay absolute inset-0" />

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-4">
        <h1 className="text-[2rem] md:text-5xl font-bold text-white mb-4 max-w-4xl leading-[1.2]">
          {title}
        </h1>
        <p className="text-base md:text-xl leading-relaxed text-white/90 max-w-2xl">
          {description}
        </p>
      </div>
    </section>
  );
}
