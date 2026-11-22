"use client";

import { useState, useTransition } from "react";
import { ArchMedia, audienceColors, audienceTint, sectorColors } from "@/components/ui/brand";
import {
  AVAILABILITY_STATUS_LABEL,
  getLandingAvailabilityStatus,
} from "@/lib/landings/availability";
import type { LandingsSummary } from "@/lib/supabase/types";
import { SECTOR_OPTIONS, TARGET_AUDIENCE_OPTIONS } from "@/types/course";

interface CourseTileProps {
  item: LandingsSummary;
  initialLiked?: boolean;
  selectionMode?: boolean;
  selected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
  /** First screenful of banners load eagerly. */
  priority?: boolean;
}

const AUDIENCE_LABEL: Record<string, string> = Object.fromEntries(
  TARGET_AUDIENCE_OPTIONS.map((o) => [o.value, o.label])
);

const SECTOR_LABEL: Record<string, string> = Object.fromEntries(
  SECTOR_OPTIONS.map((o) => [o.value, o.label])
);

function formatStartDate(iso: string | null): string {
  if (!iso) return "תאריך גמיש";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const months = [
    "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
    "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
  ];
  if (month < 1 || month > 12) return iso;
  return `${day} ב${months[month - 1]} ${year}`;
}

function formatPrice(price: number): string {
  if (price === 0) return "חינם";
  const rounded = Math.round(price);
  const withCommas = String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${withCommas} ש"ח`;
}

export function CourseTile({
  item,
  initialLiked = false,
  selectionMode = false,
  selected = false,
  onSelectedChange,
  priority = false,
}: CourseTileProps) {
  const [likes, setLikes] = useState(item.likesCount);
  const [liked, setLiked] = useState(initialLiked);
  const [isPending, startTransition] = useTransition();
  const status = getLandingAvailabilityStatus({
    endDate: item.endDate,
    courseType: item.courseType,
  });
  const ended = status === "ended";
  const sticker =
    status === "open" ? "פתוח להרשמה" : AVAILABILITY_STATUS_LABEL[status];

  const toggleLike = () => {
    startTransition(async () => {
      try {
        const r = await fetch(`/api/landings/${item.id}/likes`, { method: "POST" });
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
      className={`av-card${ended ? " is-done" : ""}${selected ? " is-selected" : ""}`}
    >
      {selectionMode && onSelectedChange ? (
        <label className="av-card-select">
          <input
            type="checkbox"
            checked={selected}
            onChange={(event) => onSelectedChange(event.target.checked)}
          />
          <span className="material-symbols-rounded" aria-hidden>
            {selected ? "check" : ""}
          </span>
          <span className="sr-only">
            {selected ? "בטל בחירה של" : "בחר למחיקה את"} {item.title || "הקורס"}
          </span>
        </label>
      ) : null}
      <a href={`/l/${item.id}`} className="av-card-link">
        <ArchMedia src={item.bannerThumbUrl} alt={item.title || "קורס"} tint={audienceTint(item.targetAudienceTags)} priority={priority} />
        <span className={`av-sticker${ended ? " is-done" : ""}`}>{sticker}</span>
        <h3>{item.title || "ללא כותרת"}</h3>
        <p className="av-desc">{item.description}</p>
        <div className="av-meta">
          <span className="material-symbols-rounded" aria-hidden style={{ fontSize: 20 }}>
            calendar_month
          </span>
          <bdi>{formatStartDate(item.startDate)}</bdi>
          {typeof item.price === "number" ? <span className="av-price">{formatPrice(item.price)}</span> : null}
        </div>
        <div className="av-tags">
          {item.targetAudienceTags.slice(0, 2).map((tag) => (
            <span key={tag} className="av-tag" style={audienceColors(tag)}>
              {AUDIENCE_LABEL[tag] || tag}
            </span>
          ))}
          {item.sector ? (
            <span className="av-tag" style={sectorColors(item.sector)}>
              {SECTOR_LABEL[item.sector] || item.sector}
            </span>
          ) : null}
        </div>
        <span className={`av-btn ${ended ? "av-btn-ghost is-disabled" : "av-btn-primary"}`}>
          {ended ? "ההרשמה נסגרה" : "לפרטים והרשמה"}
          {ended ? null : (
            <span className="material-symbols-rounded" aria-hidden style={{ fontSize: 20 }}>
              arrow_back
            </span>
          )}
        </span>
      </a>
      <button
        type="button"
        onClick={toggleLike}
        disabled={isPending}
        aria-pressed={liked}
        aria-label={liked ? "בטל לייק" : "סמן לייק"}
        className="av-fav"
      >
        <span
          className="material-symbols-rounded"
          aria-hidden
          style={{ fontSize: 20, fontVariationSettings: `'FILL' ${liked ? 1 : 0}, 'wght' 500, 'GRAD' 0, 'opsz' 24` }}
        >
          favorite
        </span>
        <span className="tabular-nums text-xs">{likes}</span>
      </button>
    </article>
  );
}
