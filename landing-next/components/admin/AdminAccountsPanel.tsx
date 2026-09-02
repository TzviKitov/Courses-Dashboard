"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProfileRow } from "@/lib/auth/types";
import {
  accountKindLabelHe,
  roleLabelHe,
  statusLabelHe,
} from "@/lib/auth/types";

interface AccountRow extends ProfileRow {
  email: string | null;
  landingsCount: number;
}

interface AllowlistRow {
  email: string;
  note: string | null;
}

export function AdminAccountsPanel() {
  const [items, setItems] = useState<AccountRow[]>([]);
  const [allowlist, setAllowlist] = useState<AllowlistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteNda, setInviteNda] = useState(false);
  const [allowEmail, setAllowEmail] = useState("");
  const [extraEmails, setExtraEmails] = useState<Record<string, string>>({});
  const [ndaAck, setNdaAck] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [accRes, alRes] = await Promise.all([
        fetch("/api/admin/accounts"),
        fetch("/api/admin/allowlist"),
      ]);
      const acc = await accRes.json();
      const al = await alRes.json();
      if (!accRes.ok) throw new Error(acc.error || "שגיאה");
      if (!alRes.ok) throw new Error(al.error || "שגיאה");
      setItems(acc.items ?? []);
      setAllowlist(al.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sortedItems = useMemo(() => {
    const rank = (row: AccountRow) => {
      if (row.role === "instructor" && row.status === "pending") return 0;
      if (row.status === "pending") return 1;
      if (row.role === "student") return 3;
      return 2;
    };
    return [...items].sort((a, b) => rank(a) - rank(b));
  }, [items]);

  const act = async (
    id: string,
    action: string,
    extra?: Record<string, unknown>
  ) => {
    const res = await fetch(`/api/admin/accounts/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const body = await res.json();
    if (!res.ok) {
      alert(body.error || "שגיאה");
      return;
    }
    await load();
  };

  const invite = async () => {
    const res = await fetch("/api/admin/accounts/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: inviteEmail,
        displayName: inviteName,
        phone: invitePhone.trim() || undefined,
        role: "instructor",
        ndaAcknowledged: inviteNda,
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      alert(body.error || "שגיאה");
      return;
    }
    setInviteEmail("");
    setInviteName("");
    setInvitePhone("");
    setInviteNda(false);
    await load();
  };

  const addAllow = async () => {
    const res = await fetch("/api/admin/allowlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: allowEmail }),
    });
    const body = await res.json();
    if (!res.ok) {
      alert(body.error || "שגיאה");
      return;
    }
    setAllowEmail("");
    await load();
  };

  const removeAllow = async (email: string) => {
    const res = await fetch(
      `/api/admin/allowlist?email=${encodeURIComponent(email)}`,
      { method: "DELETE" }
    );
    if (!res.ok) {
      const body = await res.json();
      alert(body.error || "שגיאה");
      return;
    }
    await load();
  };

  if (loading) {
    return <p className="text-sm" style={{ color: "var(--brand-text-muted)" }}>טוען...</p>;
  }
  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  return (
    <div className="space-y-10">
      <section className="rounded-2xl border p-4" style={{ borderColor: "var(--brand-border)" }}>
        <h2 className="font-bold mb-3" style={{ color: "var(--brand-text)" }}>
          הזמנת מדריך חדש
        </h2>
        <div className="flex flex-wrap gap-2">
          <input
            placeholder="שם לתצוגה"
            value={inviteName}
            onChange={(e) => setInviteName(e.target.value)}
            className="h-10 px-3 rounded-lg border text-sm"
            style={{ borderColor: "var(--brand-border)" }}
          />
          <input
            placeholder="email@example.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="h-10 px-3 rounded-lg border text-sm"
            style={{ borderColor: "var(--brand-border)" }}
            dir="ltr"
          />
          <input
            placeholder="נייד (05…)"
            value={invitePhone}
            onChange={(e) => setInvitePhone(e.target.value)}
            className="h-10 px-3 rounded-lg border text-sm"
            style={{ borderColor: "var(--brand-border)" }}
            dir="ltr"
          />
          <button
            type="button"
            onClick={() => void invite()}
            className="h-10 px-4 rounded-lg text-white text-sm font-semibold"
            style={{ background: "var(--brand-accent)" }}
          >
            שלח הזמנה
          </button>
        </div>
        <label className="mt-3 flex items-start gap-2 text-xs">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={inviteNda}
            onChange={(e) => setInviteNda(e.target.checked)}
          />
          המדריך יחתום / חתם על התחייבות סודיות (NDA) ואיסור ייצוא נתוני נערים למחשב פרטי
        </label>
      </section>

      <section className="rounded-2xl border p-4" style={{ borderColor: "var(--brand-border)" }}>
        <h2 className="font-bold mb-3" style={{ color: "var(--brand-text)" }}>
          Allowlist Microsoft (אגף)
        </h2>
        <div className="flex flex-wrap gap-2 mb-3">
          <input
            placeholder="email@org.com"
            value={allowEmail}
            onChange={(e) => setAllowEmail(e.target.value)}
            className="h-10 px-3 rounded-lg border text-sm"
            style={{ borderColor: "var(--brand-border)" }}
            dir="ltr"
          />
          <button
            type="button"
            onClick={() => void addAllow()}
            className="h-10 px-4 rounded-lg border text-sm font-medium"
            style={{ borderColor: "var(--brand-border)" }}
          >
            הוסף
          </button>
        </div>
        <ul className="text-sm space-y-1">
          {allowlist.length === 0 && (
            <li style={{ color: "var(--brand-text-muted)" }}>אין מיילים ברשימה</li>
          )}
          {allowlist.map((row) => (
            <li key={row.email} className="flex items-center justify-between gap-2">
              <span dir="ltr">{row.email}</span>
              <button
                type="button"
                className="text-xs text-red-600"
                onClick={() => void removeAllow(row.email)}
              >
                הסר
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--brand-border)" }}>
        <table className="w-full text-sm" style={{ background: "var(--brand-surface)" }}>
          <thead style={{ background: "var(--brand-accent-soft)" }}>
            <tr>
              <Th>שם</Th>
              <Th>אימייל</Th>
              <Th>תפקיד</Th>
              <Th>סטטוס</Th>
              <Th>קורסים</Th>
              <Th>גישת נערים</Th>
              <Th>הרשאות</Th>
              <Th>פעולות</Th>
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((row) => {
              const isPendingInstructor =
                row.role === "instructor" && row.status === "pending";
              const isStudent = row.role === "student";
              return (
              <tr
                key={row.id}
                className="border-t align-top"
                style={{
                  borderColor: "var(--brand-border)",
                  background: isPendingInstructor
                    ? "#fff7ed"
                    : isStudent
                      ? undefined
                      : undefined,
                }}
              >
                <td className="p-3">
                  <div className="font-medium">{row.display_name || "—"}</div>
                  {isPendingInstructor && (
                    <div className="text-[11px] font-semibold mt-0.5" style={{ color: "#b45309" }}>
                      בקשת מדריך ממתינה
                    </div>
                  )}
                  {isStudent && (
                    <div className="text-[11px] mt-0.5" style={{ color: "var(--brand-text-muted)" }}>
                      נרשם לקורס / חשבון נער
                    </div>
                  )}
                </td>
                <td className="p-3" dir="ltr">
                  {row.email || "—"}
                </td>
                <td className="p-3">{roleLabelHe(row.role)}</td>
                <td className="p-3">
                  <span
                    className="inline-block text-xs font-semibold px-2 py-0.5 rounded"
                    style={
                      isPendingInstructor
                        ? { background: "#ffedd5", color: "#9a3412" }
                        : row.status === "active"
                          ? { background: "#ecfdf5", color: "#047857" }
                          : row.status === "disabled"
                            ? { background: "#f3f4f6", color: "#4b5563" }
                            : { background: "#f3f4f6", color: "#4b5563" }
                    }
                  >
                    {isPendingInstructor
                      ? accountKindLabelHe(row.role, row.status)
                      : statusLabelHe(row.status)}
                  </span>
                </td>
                <td className="p-3 tabular-nums">{row.landingsCount}</td>
                <td className="p-3">
                  {row.can_view_all_learners ? (
                    "מאושר"
                  ) : row.requested_all_learners_at ? (
                    <span className="text-amber-700">מבקש</span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="p-3 text-xs space-y-1">
                  {row.role !== "student" && (
                    <>
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={row.can_export_registrants !== false}
                          onChange={(e) =>
                            void act(row.id, "patch_caps", {
                              can_export_registrants: e.target.checked,
                              can_view_sensitive_notes: Boolean(row.can_view_sensitive_notes),
                              can_export_sensitive_notes: Boolean(row.can_export_sensitive_notes),
                            })
                          }
                        />
                        ייצוא CSV
                      </label>
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={Boolean(row.can_view_sensitive_notes)}
                          onChange={(e) =>
                            void act(row.id, "patch_caps", {
                              can_export_registrants: row.can_export_registrants !== false,
                              can_view_sensitive_notes: e.target.checked,
                              can_export_sensitive_notes: Boolean(row.can_export_sensitive_notes),
                            })
                          }
                        />
                        צפייה בהערות
                      </label>
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={Boolean(row.can_export_sensitive_notes)}
                          onChange={(e) =>
                            void act(row.id, "patch_caps", {
                              can_export_registrants: row.can_export_registrants !== false,
                              can_view_sensitive_notes: Boolean(row.can_view_sensitive_notes),
                              can_export_sensitive_notes: e.target.checked,
                            })
                          }
                        />
                        ייצוא הערות
                      </label>
                    </>
                  )}
                </td>
                <td className="p-3">
                  <div className="flex flex-col gap-1 min-w-[180px]">
                    {isPendingInstructor && (
                      <>
                        <input
                          placeholder="מייל נוסף לאישור (אופציונלי)"
                          value={extraEmails[row.id] || ""}
                          onChange={(e) =>
                            setExtraEmails((m) => ({
                              ...m,
                              [row.id]: e.target.value,
                            }))
                          }
                          className="h-8 px-2 rounded border text-xs"
                          style={{ borderColor: "var(--brand-border)" }}
                          dir="ltr"
                        />
                        <label className="flex items-start gap-1 text-[11px] text-right">
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={Boolean(ndaAck[row.id])}
                            onChange={(e) =>
                              setNdaAck((m) => ({ ...m, [row.id]: e.target.checked }))
                            }
                          />
                          חתם על התחייבות סודיות (NDA) ואיסור ייצוא למחשב פרטי
                        </label>
                        <button
                          type="button"
                          className="text-xs font-semibold text-right"
                          style={{ color: "var(--brand-accent)" }}
                          onClick={() =>
                            void act(row.id, "approve", {
                              extraEmail: extraEmails[row.id],
                              ndaAcknowledged: Boolean(ndaAck[row.id]),
                            })
                          }
                        >
                          אשר הרשמה
                        </button>
                      </>
                    )}
                    {row.requested_all_learners_at && !row.can_view_all_learners && (
                      <>
                        <button
                          type="button"
                          className="text-xs text-right"
                          style={{ color: "var(--brand-accent)" }}
                          onClick={() => void act(row.id, "grant_learners_access")}
                        >
                          אשר גישת נערים
                        </button>
                        <button
                          type="button"
                          className="text-xs text-right text-red-600"
                          onClick={() => void act(row.id, "deny_learners_access")}
                        >
                          דחה בקשה
                        </button>
                      </>
                    )}
                    {row.role !== "admin" && row.status === "active" && (
                      <button
                        type="button"
                        className="text-xs text-right"
                        onClick={() => void act(row.id, "make_admin")}
                      >
                        הפוך למנהל
                      </button>
                    )}
                    {row.status === "active" && (
                      <button
                        type="button"
                        className="text-xs text-right"
                        onClick={() => void act(row.id, "disable")}
                      >
                        השבת
                      </button>
                    )}
                    {row.status === "disabled" && (
                      <button
                        type="button"
                        className="text-xs text-right"
                        onClick={() => void act(row.id, "enable")}
                      >
                        הפעל
                      </button>
                    )}
                    <button
                      type="button"
                      className="text-xs text-right text-red-600"
                      onClick={() => {
                        if (
                          confirm(
                            "למחוק משתמש? הקורסים יועברו אליך כמנהל."
                          )
                        ) {
                          void act(row.id, "delete");
                        }
                      }}
                    >
                      מחק
                    </button>
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      className="p-3 text-right text-xs font-semibold"
      style={{ color: "var(--brand-accent)" }}
    >
      {children}
    </th>
  );
}
