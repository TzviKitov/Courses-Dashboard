"use client";

import { useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { usePreserveViewNavigation } from "@/lib/navigation/preserve-view";
import {
  ManagementRecordCard,
  RecordMeta,
  ResponsiveRecords,
} from "@/components/dashboard/ResponsiveRecords";

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
  const searchParams = useSearchParams();
  const replace = usePreserveViewNavigation();

  const replaceQuery = useCallback(
    (next: URLSearchParams) => {
      const qs = next.toString();
      replace(qs ? `/dashboard/admin/usage?${qs}` : "/dashboard/admin/usage");
    },
    [replace]
  );

  const setFilter = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(searchParams.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      next.delete("page");
      replaceQuery(next);
    },
    [replaceQuery, searchParams]
  );

  const goPage = (p: number) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("page", String(p));
    replaceQuery(next);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          className="text-sm border rounded-md px-2 py-1"
          style={{ borderColor: "var(--brand-border)" }}
          data-preserve-focus="usage-type"
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

      <div className="mb-4">
      <ResponsiveRecords
        cards={items.map((row) => (
          <ManagementRecordCard
            key={row.id}
            title={EVENT_LABELS[row.eventType] ?? row.eventType}
            subtitle={row.userEmail}
          >
            <RecordMeta
              items={[
                {
                  label: "זמן",
                  value: new Date(row.createdAt).toLocaleString("he-IL"),
                },
                { label: "קורס", value: row.landingId ?? "—" },
                {
                  label: "פרטים",
                  value:
                    row.metadata?.durationMs != null
                      ? `${row.metadata.durationMs}ms`
                      : row.metadata?.error
                        ? String(row.metadata.error).slice(0, 80)
                        : "—",
                },
              ]}
            />
          </ManagementRecordCard>
        ))}
        table={
          <div
            className="overflow-x-auto rounded-2xl border"
            style={{ borderColor: "var(--brand-border)" }}
          >
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
        }
      />
      </div>

      <div className="flex items-center justify-between text-sm" style={{ color: "var(--brand-text-muted)" }}>
        <span>
          סה״כ {total} אירועים — עמוד {page} מתוך {totalPages || 1}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            data-preserve-focus="usage-page-prev"
            disabled={page <= 1}
            onClick={() => goPage(page - 1)}
            className="px-3 py-1 border rounded-md disabled:opacity-40 hover-nudge"
            style={{ borderColor: "var(--brand-border)" }}
          >
            הקודם
          </button>
          <button
            type="button"
            data-preserve-focus="usage-page-next"
            disabled={page >= totalPages}
            onClick={() => goPage(page + 1)}
            className="px-3 py-1 border rounded-md disabled:opacity-40 hover-nudge"
            style={{ borderColor: "var(--brand-border)" }}
          >
            הבא
          </button>
        </div>
      </div>
    </div>
  );
}
