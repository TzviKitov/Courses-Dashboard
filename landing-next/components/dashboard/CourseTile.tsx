"use client";

import { useState, useTransition } from "react";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import {
  AVAILABILITY_STATUS_LABEL,
  getLandingAvailabilityStatus,
} from "@/lib/landings/availability";
import type { LandingsSummary } from "@/lib/supabase/types";
import { TARGET_AUDIENCE_OPTIONS, SECTOR_OPTIONS } from "@/types/course";

interface CourseTileProps {
  item: LandingsSummary;
  /** Whether the current visitor already liked this course (from server). */
  initialLiked?: boolean;
}

const AUDIENCE_LABEL: Record<string, string> = Object.fromEntries(
  TARGET_AUDIENCE_OPTIONS.map((o) => [o.value, o.label])
);

const SECTOR_LABEL: Record<string, string> = Object.fromEntries(
  SECTOR_OPTIONS.map((o) => [o.value, o.label])
);

function formatStartDate(iso: string | null): string {
  if (!iso) return "תאריך גמיש";
  // Parse YYYY-MM-DD as calendar date (avoid SSR/client timezone + locale mismatches).
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const months = [
    "ינואר",
    "פברואר",
    "מרץ",
    "אפריל",
    "מאי",
    "יוני",
    "יולי",
    "אוגוסט",
    "ספטמבר",
    "אוקטובר",
    "נובמבר",
    "דצמבר",
  ];
  if (month < 1 || month > 12) return iso;
  return `${day} ב${months[month - 1]} ${year}`;
}

function formatPrice(price: number): string {
  if (price === 0) return "חינם";
  // Deterministic digits (no toLocaleString) to keep SSR and client HTML identical.
  const rounded = Math.round(price);
  const withCommas = String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${withCommas} ש"ח`;
}

function getStatusBadge(item: LandingsSummary): {
  label: string;
  background: string;
  color: string;
} {
  const status = getLandingAvailabilityStatus({
    endDate: item.endDate,
    courseType: item.courseType,
  });

  if (status === "ended") {
    return {
      label: AVAILABILITY_STATUS_LABEL.ended,
      background: "#f1f5f9",
      color: "#334155",
    };
  }

  if (status === "year_round") {
    return {
      label: AVAILABILITY_STATUS_LABEL.year_round,
      background: "var(--brand-accent-soft)",
      color: "var(--brand-accent)",
    };
  }

  return {
    label: AVAILABILITY_STATUS_LABEL.open,
    background: "var(--brand-accent-soft)",
    color: "var(--brand-accent)",
  };
}

export function CourseTile({ item, initialLiked = false }: CourseTileProps) {
  const [likes, setLikes] = useState(item.likesCount);
  const [liked, setLiked] = useState(initialLiked);
  const [isPending, startTransition] = useTransition();
  const status = getStatusBadge(item);

  const toggleLike = () => {
    startTransition(async () => {
      try {
        const r = await fetch(`/api/landings/${item.id}/likes`, {
          method: "POST",
        });
        const data = await r.json();
        if (data?.success) {
          setLikes(data.count);
          setLiked(Boolean(data.liked));
        }
      } catch {
        // ignore - leaves UI unchanged
      }
    });
  };

  return (
    <article
      className="group relative public-card border overflow-hidden h-full"
      style={{
        background: "var(--brand-surface)",
        borderColor: "var(--brand-border)",
        boxShadow: "var(--brand-shadow)",
      }}
    >
      <a
        href={`/l/${item.id}`}
        className="hover-quiet flex h-full flex-col focus:outline-none cursor-pointer rounded-[inherit] overflow-hidden"
      >
        <div
          className="relative aspect-[16/9] overflow-hidden shrink-0"
          style={{ background: "var(--brand-accent-soft)" }}
        >
          {item.bannerThumbUrl ? (
            <OptimizedImage
              src={item.bannerThumbUrl}
              alt={item.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center text-sm font-semibold"
              style={{ color: "var(--brand-accent)" }}
            >
              ללא תמונה
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col p-5 sm:p-6">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3
              className="text-xl font-bold leading-snug line-clamp-2 min-h-[2.6em] transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:underline"
              style={{ color: "var(--brand-text)" }}
            >
              {item.title || "ללא כותרת"}
            </h3>
          </div>

          <p
            className="text-base leading-6 mb-4 line-clamp-2 min-h-12"
            style={{ color: "var(--brand-text-muted)" }}
          >
            {item.description}
          </p>

          <div
            className="flex flex-wrap items-center gap-2 text-sm"
            style={{ color: "var(--brand-text-muted)" }}
          >
            <span
              className="inline-flex items-center rounded-full px-2.5 py-1 text-sm font-medium"
              style={{ background: status.background, color: status.color }}
            >
              {status.label}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                calendar_month
              </span>
              {formatStartDate(item.startDate)}
            </span>
            {item.sector && (
              <span
                className="px-2.5 py-1 rounded-full text-sm font-medium"
                style={{
                  background: "var(--brand-accent-soft)",
                  color: "var(--brand-accent)",
                }}
              >
                {SECTOR_LABEL[item.sector] || item.sector}
              </span>
            )}
            {item.targetAudienceTags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-1 rounded-full text-sm font-medium border"
                style={{
                  borderColor: "var(--brand-border)",
                  color: "var(--brand-text-muted)",
                }}
              >
                {AUDIENCE_LABEL[tag] || tag}
              </span>
            ))}
          </div>

          <p
            className="mt-4 text-base font-bold min-h-6"
            style={{ color: "var(--brand-text)" }}
          >
            {typeof item.price === "number" ? formatPrice(item.price) : ""}
          </p>

          <div className="mt-auto pt-5">
            <div
              className="min-h-12 w-full rounded-xl inline-flex items-center justify-center gap-2 px-4 text-base font-bold leading-none"
              style={{
                background: "var(--brand-accent)",
                color: "var(--brand-accent-contrast)",
              }}
            >
              לפרטים והרשמה
              <span
                className="material-symbols-outlined leading-none"
                aria-hidden
                style={{ fontSize: 20 }}
              >
                arrow_back
              </span>
            </div>
          </div>
        </div>
      </a>

      <button
        type="button"
        onClick={toggleLike}
        disabled={isPending}
        aria-pressed={liked}
        aria-label={liked ? "בטל לייק" : "סמן לייק"}
        className="absolute top-3 left-3 z-10 inline-flex items-center justify-center gap-1 rounded-full px-3 min-h-12 min-w-12 text-sm font-bold transition-all cursor-pointer disabled:cursor-not-allowed hover-chip"
        style={{
          background: liked ? "var(--brand-accent)" : "rgba(255,255,255,0.92)",
          color: liked ? "#fff" : "var(--brand-text)",
          boxShadow: "var(--brand-shadow)",
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
          {liked ? "favorite" : "favorite_border"}
        </span>
        <span className="tabular-nums">{likes}</span>
      </button>
    </article>
  );
}
