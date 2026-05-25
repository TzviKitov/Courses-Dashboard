interface BarPoint {
  date: string;
  count: number;
}

interface AdminBarChartProps {
  title: string;
  data: BarPoint[];
}

export function AdminBarChart({ title, data }: AdminBarChartProps) {
  const max = Math.max(1, ...data.map((d) => d.count));

  return (
    <div
      className="rounded-2xl border p-4"
      style={{ borderColor: "var(--brand-border)", background: "var(--brand-surface)" }}
    >
      <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--brand-text)" }}>
        {title}
      </h3>
      <div className="flex items-end gap-1 h-28">
        {data.map((point) => (
          <div key={point.date} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <div
              className="w-full rounded-t"
              style={{
                height: `${Math.max(8, (point.count / max) * 96)}px`,
                background: "var(--brand-accent)",
              }}
              title={`${point.count}`}
            />
            <span
              className="text-[9px] truncate w-full text-center"
              style={{ color: "var(--brand-text-muted)" }}
            >
              {point.date.slice(5)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
