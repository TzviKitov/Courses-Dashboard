"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

interface UsageRow {
  id: string;
  eventType: string;
  userEmail: string;
  landingId: string | null;
  sessionId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface AdminUsageTableProps {
  items: UsageRow[];
  page: number;
  totalPages: number;
  total: number;
}

const EVENT_LABELS: Record<string, string> = {
  banner_start: "התחלת באנר",
  banner_success: "באנר הצליח",
  banner_error: "שגיאת באנר",
  landing_created: "קורס נוצר",
};

export function AdminUsageTable({
  items,
  page,
  totalPages,
  total,
}: AdminUsageTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setFilter = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(searchParams.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      next.delete("page");
      router.push(`/dashboard/admin/usage?${next.toString()}`);
    },
    [router, searchParams]
  );

  const goPage = (p: number) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("page", String(p));
    router.push(`/dashboard/admin/usage?${next.toString()}`);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          className="text-sm border rounded-md px-2 py-1"
          style={{ borderColor: "var(--brand-border)" }}
          value={searchParams.get("type") ?? ""}
          onChange={(e) => setFilter("type", e.target.value)}
        >
          <option value="">כל הסוגים</option>
          {Object.entries(EVENT_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border mb-4" style={{ borderColor: "var(--brand-border)" }}>
        <table className="w-full text-sm" style={{ background: "var(--brand-surface)" }}>
          <thead style={{ background: "var(--brand-accent-soft)" }}>
            <tr>
              <th className="p-3 text-right text-xs font-semibold" style={{ color: "var(--brand-accent)" }}>
                זמן
              </th>
              <th className="p-3 text-right text-xs font-semibold" style={{ color: "var(--brand-accent)" }}>
                סוג
              </th>
              <th className="p-3 text-right text-xs font-semibold" style={{ color: "var(--brand-accent)" }}>
                משתמש
              </th>
              <th className="p-3 text-right text-xs font-semibold" style={{ color: "var(--brand-accent)" }}>
                קורס
              </th>
              <th className="p-3 text-right text-xs font-semibold" style={{ color: "var(--brand-accent)" }}>
                פרטים
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id} className="border-t" style={{ borderColor: "var(--brand-border)" }}>
                <td className="p-3 text-xs whitespace-nowrap" style={{ color: "var(--brand-text-muted)" }}>
                  {new Date(row.createdAt).toLocaleString("he-IL")}
                </td>
                <td className="p-3 text-xs">{EVENT_LABELS[row.eventType] ?? row.eventType}</td>
                <td className="p-3 text-xs">{row.userEmail}</td>
                <td className="p-3 text-xs font-mono">{row.landingId ?? "—"}</td>
                <td className="p-3 text-xs max-w-xs truncate" style={{ color: "var(--brand-text-muted)" }}>
                  {row.metadata?.durationMs != null
                    ? `${row.metadata.durationMs}ms`
                    : row.metadata?.error
                      ? String(row.metadata.error).slice(0, 80)
                      : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm" style={{ color: "var(--brand-text-muted)" }}>
        <span>
          סה״כ {total} אירועים — עמוד {page} מתוך {totalPages || 1}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => goPage(page - 1)}
            className="px-3 py-1 border rounded-md disabled:opacity-40"
            style={{ borderColor: "var(--brand-border)" }}
          >
            הקודם
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => goPage(page + 1)}
            className="px-3 py-1 border rounded-md disabled:opacity-40"
            style={{ borderColor: "var(--brand-border)" }}
          >
            הבא
          </button>
        </div>
      </div>
    </div>
  );
}
