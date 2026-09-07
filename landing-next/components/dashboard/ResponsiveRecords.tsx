import type { ReactNode } from "react";

/**
 * Desktop keeps a data table; phones get stacked cards with the same actions.
 */
export function ResponsiveRecords({
  table,
  cards,
}: {
  table: ReactNode;
  cards: ReactNode;
}) {
  return (
    <>
      <div className="md:hidden space-y-3">{cards}</div>
      <div className="hidden md:block">{table}</div>
    </>
  );
}

export function ManagementRecordCard({
  title,
  subtitle,
  media,
  badge,
  children,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  media?: ReactNode;
  badge?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <article
      className="management-card border p-4 space-y-3"
      style={{
        background: "var(--brand-surface)",
        borderColor: "var(--brand-border)",
        boxShadow: "var(--brand-shadow)",
      }}
    >
      <div className="flex items-start gap-3">
        {media}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3
                className="font-bold leading-snug"
                style={{ color: "var(--brand-text)" }}
              >
                {title}
              </h3>
              {subtitle ? (
                <p
                  className="text-sm mt-0.5 line-clamp-2"
                  style={{ color: "var(--brand-text-muted)" }}
                >
                  {subtitle}
                </p>
              ) : null}
            </div>
            {badge}
          </div>
        </div>
      </div>
      {children}
      {actions ? (
        <div
          className="pt-3 border-t flex flex-wrap gap-2"
          style={{ borderColor: "var(--brand-border)" }}
        >
          {actions}
        </div>
      ) : null}
    </article>
  );
}

export function RecordMeta({
  items,
}: {
  items: { label: string; value: ReactNode }[];
}) {
  return (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs" style={{ color: "var(--brand-text-muted)" }}>
            {item.label}
          </dt>
          <dd
            className="font-medium break-words"
            style={{ color: "var(--brand-text)" }}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function VisibilityBadge({ isPublic }: { isPublic: boolean }) {
  return (
    <span
      className="shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium"
      style={{
        background: isPublic ? "var(--brand-accent-soft)" : "#fff5ef",
        color: isPublic ? "var(--brand-accent)" : "#7a4a1d",
      }}
    >
      {isPublic ? "פעיל" : "מוסתר"}
    </span>
  );
}
