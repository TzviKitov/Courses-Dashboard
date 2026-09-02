"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type {
  AcceptanceStatus,
  RegistrationAttachmentRow,
  RegistrationRow,
} from "@/lib/supabase/types";
import { NotesGuidance } from "@/components/privacy/NotesGuidance";

interface Form1ClientProps {
  landingId: string;
  title: string;
  open: boolean;
  dueDate: string | null;
  items: RegistrationRow[];
  attachments: RegistrationAttachmentRow[];
  /** When set, uses token API instead of dashboard API */
  token?: string;
  backHref: string;
}

export function Form1Client({
  landingId,
  title,
  open,
  dueDate,
  items,
  attachments,
  token,
  backHref,
}: Form1ClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [rows, setRows] = useState(
    items.map((r) => ({
      id: r.id,
      full_name: r.full_name,
      acceptance_status: r.acceptance_status as AcceptanceStatus | null,
      form1_notes: r.form1_notes ?? "",
    }))
  );

  const attsByReg = useMemo(() => {
    const map = new Map<string, RegistrationAttachmentRow[]>();
    for (const att of attachments) {
      const list = map.get(att.registration_id) ?? [];
      list.push(att);
      map.set(att.registration_id, list);
    }
    return map;
  }, [attachments]);

  const saveUrl = token
    ? `/api/forms/${token}/form1`
    : `/api/landings/${landingId}/followups/form1`;

  const save = () => {
    startTransition(async () => {
      setError("");
      setOk("");
      const r = await fetch(saveUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: rows.map((row) => ({
            id: row.id,
            acceptance_status: row.acceptance_status,
            form1_notes: row.form1_notes,
          })),
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(data.error || "שגיאה בשמירה");
        return;
      }
      setOk("נשמר בהצלחה");
      router.refresh();
    });
  };

  const uploadFile = async (regId: string, file: File) => {
    setError("");
    const fd = new FormData();
    fd.append("file", file);
    const url = token
      ? `/api/forms/${token}/attachments/${regId}`
      : `/api/landings/${landingId}/registrations/${regId}/attachments`;
    const r = await fetch(url, { method: "POST", body: fd });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError(data.error || "שגיאה בהעלאה");
      return;
    }
    router.refresh();
  };

  if (!open) {
    return (
      <LockedNotice
        title="טופס 1 — קבלה לנרשמים"
        dueDate={dueDate}
        backHref={backHref}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Header
        title={`טופס 1 — ${title || "קבלה"}`}
        subtitle="סמן התקבל/לא התקבל, צרף קבצים והוסף הערות."
        backHref={backHref}
      />
      <NotesGuidance />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {ok && <p className="text-sm text-green-700">{ok}</p>}

      <div className="space-y-4">
        {rows.map((row, idx) => (
          <div
            key={row.id}
            className="rounded-xl border p-4"
            style={{
              borderColor: "var(--brand-border)",
              background: "var(--brand-surface)",
            }}
          >
            <p className="font-bold mb-3" style={{ color: "var(--brand-text)" }}>
              {row.full_name}
            </p>
            <div className="flex flex-wrap gap-4 mb-3">
              <label className="text-sm flex items-center gap-2">
                <input
                  type="radio"
                  name={`acc-${row.id}`}
                  checked={row.acceptance_status === "accepted"}
                  onChange={() =>
                    setRows((prev) => {
                      const next = [...prev];
                      next[idx] = { ...next[idx], acceptance_status: "accepted" };
                      return next;
                    })
                  }
                />
                התקבל
              </label>
              <label className="text-sm flex items-center gap-2">
                <input
                  type="radio"
                  name={`acc-${row.id}`}
                  checked={row.acceptance_status === "rejected"}
                  onChange={() =>
                    setRows((prev) => {
                      const next = [...prev];
                      next[idx] = { ...next[idx], acceptance_status: "rejected" };
                      return next;
                    })
                  }
                />
                לא התקבל
              </label>
            </div>
            <textarea
              className="w-full text-sm border rounded p-2 mb-3"
              rows={2}
              placeholder="הערות נוספות"
              value={row.form1_notes}
              onChange={(e) =>
                setRows((prev) => {
                  const next = [...prev];
                  next[idx] = { ...next[idx], form1_notes: e.target.value };
                  return next;
                })
              }
              style={{ borderColor: "var(--brand-border)" }}
            />
            <div className="text-xs space-y-1 mb-2" style={{ color: "var(--brand-text-muted)" }}>
              {(attsByReg.get(row.id) ?? []).map((a) => (
                <div key={a.id}>📎 {a.file_name}</div>
              ))}
            </div>
            <input
              type="file"
              accept=".pdf,image/jpeg,image/png"
              className="text-xs"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadFile(row.id, f);
                e.target.value = "";
              }}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={isPending || rows.length === 0}
        onClick={save}
        className="px-4 py-2 rounded-md text-white text-sm font-bold disabled:opacity-50 hover-nudge"
        style={{ background: "var(--brand-accent)" }}
      >
        {isPending ? "שומר..." : "שמור טופס 1"}
      </button>
    </div>
  );
}

export function LockedNotice({
  title,
  dueDate,
  backHref,
}: {
  title: string;
  dueDate: string | null;
  backHref: string;
}) {
  return (
    <div className="space-y-4 text-center py-10">
      <h2 className="text-lg font-bold" style={{ color: "var(--brand-text)" }}>
        {title}
      </h2>
      <p className="text-sm" style={{ color: "var(--brand-text-muted)" }}>
        הטופס עדיין לא זמין
        {dueDate ? ` (מילוי החל מ-${dueDate})` : ""}.
      </p>
      <Link href={backHref} className="text-sm underline hover-wiggle" style={{ color: "var(--brand-accent)" }}>
        חזרה
      </Link>
    </div>
  );
}

export function Header({
  title,
  subtitle,
  backHref,
}: {
  title: string;
  subtitle: string;
  backHref: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold" style={{ color: "var(--brand-text)" }}>
          {title}
        </h2>
        <p className="text-xs mt-1" style={{ color: "var(--brand-text-muted)" }}>
          {subtitle}
        </p>
      </div>
      <Link
        href={backHref}
        className="text-xs underline hover-wiggle"
        style={{ color: "var(--brand-text-muted)" }}
      >
        חזרה
      </Link>
    </div>
  );
}
