"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type {
  RegistrationAttachmentRow,
  RegistrationRow,
} from "@/lib/supabase/types";

interface RegistrantsTableProps {
  landingId: string;
  title: string;
  items: RegistrationRow[];
  attachments: RegistrationAttachmentRow[];
  windows: { form1: boolean; form2: boolean; form3: boolean };
  dueDates: { form1: string | null; form2: string | null; form3: string | null };
}

export function RegistrantsTable({
  landingId,
  title,
  items,
  attachments,
  windows,
  dueDates,
}: RegistrantsTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  const { active, cancelled } = useMemo(() => {
    const a: RegistrationRow[] = [];
    const c: RegistrationRow[] = [];
    for (const row of items) {
      if (row.cancelled_at) c.push(row);
      else a.push(row);
    }
    return { active: a, cancelled: c };
  }, [items]);

  const attsByReg = useMemo(() => {
    const map = new Map<string, RegistrationAttachmentRow[]>();
    for (const att of attachments) {
      const list = map.get(att.registration_id) ?? [];
      list.push(att);
      map.set(att.registration_id, list);
    }
    return map;
  }, [attachments]);

  const saveNotes = (id: string) => {
    const value = notesDraft[id];
    if (value === undefined) return;
    startTransition(async () => {
      setError("");
      const r = await fetch(`/api/landings/${landingId}/registrations`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, instructor_notes: value }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(data.error || "שגיאה בשמירה");
        return;
      }
      router.refresh();
    });
  };

  const cancelReg = (id: string) => {
    const reason = window.prompt("סיבת ביטול ההרשמה (חובה):");
    if (reason === null) return;
    if (!reason.trim()) {
      setError("חובה למלא סיבת ביטול");
      return;
    }
    startTransition(async () => {
      setError("");
      const r = await fetch(`/api/landings/${landingId}/registrations`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          cancel: true,
          cancellation_reason: reason.trim(),
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(data.error || "שגיאה בביטול");
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color: "var(--brand-text)" }}>
            {title || "נרשמים"}
          </h2>
          <p className="text-xs mt-1" style={{ color: "var(--brand-text-muted)" }}>
            {active.length} פעילים · {cancelled.length} מבוטלים
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <FormLink
            href={`/dashboard/my/${landingId}/forms/1`}
            label="טופס 1 — קבלה"
            open={windows.form1}
            due={dueDates.form1}
          />
          <FormLink
            href={`/dashboard/my/${landingId}/forms/2`}
            label="טופס 2 — סיום"
            open={windows.form2}
            due={dueDates.form2}
          />
          <FormLink
            href={`/dashboard/my/${landingId}/forms/3`}
            label="טופס 3 — השמה"
            open={windows.form3}
            due={dueDates.form3}
          />
          <a
            href={`/api/landings/${landingId}/registrations?format=csv`}
            className="px-3 py-1.5 text-xs font-medium rounded-md border hover-nudge"
            style={{ borderColor: "var(--brand-border)", color: "var(--brand-accent)" }}
          >
            ייצוא CSV
          </a>
          <Link
            href="/dashboard/my"
            className="px-3 py-1.5 text-xs font-medium rounded-md border hover-nudge"
            style={{ borderColor: "var(--brand-border)", color: "var(--brand-text-muted)" }}
          >
            חזרה
          </Link>
        </div>
      </div>

      {error && (
        <p className="text-sm" style={{ color: "#c43030" }}>
          {error}
        </p>
      )}

      <Section title="נרשמים פעילים">
        {active.length === 0 ? (
          <Empty>אין נרשמים עדיין.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1100px]">
              <thead style={{ background: "var(--brand-accent-soft)" }}>
                <tr>
                  <Th>שם</Th>
                  <Th>טלפון</Th>
                  <Th>אימייל</Th>
                  <Th>הפניה</Th>
                  <Th>זמינות לראיון</Th>
                  <Th>הערות מדריך</Th>
                  <Th>קבלה</Th>
                  <Th>סיום</Th>
                  <Th>השמה</Th>
                  <Th>קבצים</Th>
                  <Th>פעולות</Th>
                </tr>
              </thead>
              <tbody>
                {active.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t"
                    style={{ borderColor: "var(--brand-border)" }}
                  >
                    <Td>
                      {row.user_id ? (
                        <Link
                          href={`/dashboard/my/learners/${row.user_id}`}
                          className="underline hover-wiggle"
                          style={{ color: "var(--brand-accent)" }}
                        >
                          {row.full_name}
                        </Link>
                      ) : (
                        row.full_name
                      )}
                    </Td>
                    <Td>{row.phone}</Td>
                    <Td>{row.email || "—"}</Td>
                    <Td>{row.referral || "—"}</Td>
                    <Td className="max-w-[140px] truncate" title={row.notes ?? ""}>
                      {row.notes || "—"}
                    </Td>
                    <Td>
                      <div className="flex flex-col gap-1 min-w-[160px]">
                        <textarea
                          className="text-xs border rounded p-1 w-full"
                          rows={2}
                          defaultValue={row.instructor_notes ?? ""}
                          onChange={(e) =>
                            setNotesDraft((prev) => ({
                              ...prev,
                              [row.id]: e.target.value,
                            }))
                          }
                          style={{
                            borderColor: "var(--brand-border)",
                            background: "var(--brand-surface)",
                          }}
                        />
                        <button
                          type="button"
                          disabled={isPending || notesDraft[row.id] === undefined}
                          onClick={() => saveNotes(row.id)}
                          className="text-[11px] underline disabled:opacity-40 self-start hover-wiggle"
                          style={{ color: "var(--brand-accent)" }}
                        >
                          שמור הערות
                        </button>
                      </div>
                    </Td>
                    <Td>
                      <StatusCell
                        value={labelAcceptance(row.acceptance_status)}
                        locked={!windows.form1}
                        due={dueDates.form1}
                      />
                    </Td>
                    <Td>
                      <StatusCell
                        value={labelCompletion(row.completion_status)}
                        locked={!windows.form2}
                        due={dueDates.form2}
                      />
                    </Td>
                    <Td>
                      <StatusCell
                        value={labelPlacement(row.placement_status, row.placement_where)}
                        locked={!windows.form3}
                        due={dueDates.form3}
                      />
                    </Td>
                    <Td>
                      {(attsByReg.get(row.id) ?? []).length || "—"}
                    </Td>
                    <Td>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => cancelReg(row.id)}
                        className="text-xs underline disabled:opacity-50 hover-wiggle"
                        style={{ color: "#c43030" }}
                      >
                        בטל הרשמה
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {cancelled.length > 0 && (
        <Section title="מבוטלים (לתיעוד)">
          <div className="overflow-x-auto">
            <table className="w-full text-sm opacity-60">
              <thead>
                <tr>
                  <Th>שם</Th>
                  <Th>טלפון</Th>
                  <Th>סיבת ביטול</Th>
                  <Th>תאריך ביטול</Th>
                </tr>
              </thead>
              <tbody>
                {cancelled.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t"
                    style={{
                      borderColor: "var(--brand-border)",
                      background: "#f3f3f3",
                    }}
                  >
                    <Td>
                      <span className="line-through">{row.full_name}</span>
                    </Td>
                    <Td>{row.phone}</Td>
                    <Td>{row.cancellation_reason || row.instructor_notes || "—"}</Td>
                    <Td>{row.cancelled_at?.slice(0, 10) || "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  );
}

function FormLink({
  href,
  label,
  open,
  due,
}: {
  href: string;
  label: string;
  open: boolean;
  due: string | null;
}) {
  if (!open) {
    return (
      <span
        className="px-3 py-1.5 text-xs rounded-md border opacity-50 cursor-not-allowed"
        style={{ borderColor: "var(--brand-border)", color: "var(--brand-text-muted)" }}
        title={due ? `זמין מ-${due}` : "אין תאריך"}
      >
        {label} (נעול)
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="px-3 py-1.5 text-xs font-medium rounded-md text-white hover-nudge"
      style={{ background: "var(--brand-accent)" }}
    >
      {label}
    </Link>
  );
}

function StatusCell({
  value,
  locked,
  due,
}: {
  value: string;
  locked: boolean;
  due: string | null;
}) {
  return (
    <span
      className={`text-xs ${locked ? "opacity-40" : ""}`}
      title={locked ? (due ? `מילוי מ-${due}` : "עדיין לא זמין") : undefined}
    >
      {value}
      {locked ? " 🔒" : ""}
    </span>
  );
}

function labelAcceptance(v: RegistrationRow["acceptance_status"]) {
  if (v === "accepted") return "התקבל";
  if (v === "rejected") return "לא התקבל";
  return "—";
}

function labelCompletion(v: RegistrationRow["completion_status"]) {
  if (v === "completed") return "סיים";
  if (v === "dropped") return "נשר";
  return "—";
}

function labelPlacement(status: boolean | null, where: string | null) {
  if (status === true) return where ? `כן — ${where}` : "כן";
  if (status === false) return "לא";
  return "—";
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-2xl border overflow-hidden"
      style={{
        background: "var(--brand-surface)",
        borderColor: "var(--brand-border)",
      }}
    >
      <div
        className="px-4 py-2 text-xs font-semibold border-b"
        style={{
          borderColor: "var(--brand-border)",
          color: "var(--brand-accent)",
          background: "var(--brand-accent-soft)",
        }}
      >
        {title}
      </div>
      <div className="p-2">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="p-6 text-center text-sm" style={{ color: "var(--brand-text-muted)" }}>
      {children}
    </p>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      className="p-2 text-right text-[11px] font-semibold whitespace-nowrap"
      style={{ color: "var(--brand-accent)" }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <td
      className={`p-2 align-top ${className}`}
      style={{ color: "var(--brand-text)" }}
      title={title}
    >
      {children}
    </td>
  );
}
