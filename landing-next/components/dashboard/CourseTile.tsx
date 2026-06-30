"use client";

import { useEffect, useState, useTransition } from "react";
import type { LandingsSummary } from "@/lib/supabase/types";
import { TARGET_AUDIENCE_OPTIONS, SECTOR_OPTIONS } from "@/types/course";

interface CourseTileProps {
  item: LandingsSummary;
}

const AUDIENCE_LABEL: Record<string, string> = Object.fromEntries(
  TARGET_AUDIENCE_OPTIONS.map((o) => [o.value, o.label])
);

const SECTOR_LABEL: Record<string, string> = Object.fromEntries(
  SECTOR_OPTIONS.map((o) => [o.value, o.label])
);

function formatStartDate(iso: string | null): string {
  if (!iso) return "תאריך גמיש";
  try {
    return new Date(iso).toLocaleDateString("he-IL", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function CourseTile({ item }: CourseTileProps) {
  const [likes, setLikes] = useState(item.likesCount);
  const [liked, setLiked] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Fetch current "liked by me" state on mount.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/landings/${item.id}/likes`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data?.success) return;
        setLikes(data.count ?? item.likesCount);
        setLiked(Boolean(data.liked));
      })
      .catch(() => {
        // Likes endpoint may be unavailable when Supabase is not configured.
      });
    return () => {
      cancelled = true;
    };
  }, [item.id, item.likesCount]);

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
      className="group relative rounded-2xl overflow-hidden border transition-shadow"
      style={{
        background: "var(--brand-surface)",
        borderColor: "var(--brand-border)",
        boxShadow: "var(--brand-shadow)",
      }}
    >
        <a
          href={`/l/${item.id}`}
          className="block focus:outline-none"
        >
        <div
          className="aspect-[16/9] overflow-hidden"
          style={{ background: "var(--brand-accent-soft)" }}
        >
          {item.bannerThumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.bannerThumbUrl}
              alt={item.title}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
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

        <div className="p-5">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3
              className="text-lg font-bold leading-tight line-clamp-2 group-hover:underline"
              style={{ color: "var(--brand-text)" }}
            >
              {item.title || "ללא כותרת"}
            </h3>
          </div>

          {item.description && (
            <p
              className="text-sm mb-3 line-clamp-2"
              style={{ color: "var(--brand-text-muted)" }}
            >
              {item.description}
            </p>
          )}

          <div
            className="flex flex-wrap items-center gap-2 text-xs"
            style={{ color: "var(--brand-text-muted)" }}
          >
            <span className="inline-flex items-center gap-1">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                calendar_month
              </span>
              {formatStartDate(item.startDate)}
            </span>
            {item.sector && (
              <span
                className="px-2 py-0.5 rounded-full text-[11px] font-medium"
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
                className="px-2 py-0.5 rounded-full text-[11px] font-medium border"
                style={{
                  borderColor: "var(--brand-border)",
                  color: "var(--brand-text-muted)",
                }}
              >
                {AUDIENCE_LABEL[tag] || tag}
              </span>
            ))}
          </div>

          {typeof item.price === "number" && (
            <p
              className="mt-3 text-sm font-bold"
              style={{ color: "var(--brand-text)" }}
            >
              {item.price === 0 ? "חינם" : `${item.price.toLocaleString("he-IL")} ש"ח`}
            </p>
          )}
        </div>
        </a>

      {/* Like button - absolutely positioned over the corner, separate from the link target */}
      <button
        type="button"
        onClick={toggleLike}
        disabled={isPending}
        aria-pressed={liked}
        aria-label={liked ? "בטל לייק" : "סמן לייק"}
        className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full px-3 h-9 text-xs font-bold transition-all"
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
