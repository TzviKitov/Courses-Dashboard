"use client";

import { useCallback, useEffect, useState } from "react";

interface AccountOption {
  id: string;
  email: string | null;
  display_name: string | null;
  role: string;
  status: string;
}

export function CourseInstructorsAdmin({ landingId }: { landingId: string }) {
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/accounts");
      const body = await res.json();
      if (!res.ok) return;
      const items = (body.items ?? []) as AccountOption[];
      setAccounts(
        items.filter(
          (a) =>
            a.status === "active" &&
            (a.role === "instructor" || a.role === "admin")
        )
      );
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const run = async (action: "set_owner" | "add" | "remove") => {
    if (!selectedId) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/landings/${landingId}/instructors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, userId: selectedId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "שגיאה");
      setMessage(
        action === "set_owner"
          ? "המדריך הראשי עודכן"
          : action === "add"
            ? "מדריך נוסף"
            : "מדריך הוסר"
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "שגיאה");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="mt-2 p-2 rounded-lg border text-xs space-y-2"
      style={{ borderColor: "var(--brand-border)" }}
    >
      <p style={{ color: "var(--brand-text-muted)" }}>ניהול מדריכים לקורס</p>
      <select
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        className="w-full h-8 px-2 rounded border text-xs"
        style={{ borderColor: "var(--brand-border)" }}
      >
        <option value="">בחר מדריך...</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {(a.display_name || a.email || a.id).slice(0, 40)}
            {a.email ? ` · ${a.email}` : ""}
          </option>
        ))}
      </select>
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          disabled={loading || !selectedId}
          onClick={() => void run("set_owner")}
          className="px-2 py-1 rounded border"
          style={{ borderColor: "var(--brand-border)" }}
        >
          החלף ראשי
        </button>
        <button
          type="button"
          disabled={loading || !selectedId}
          onClick={() => void run("add")}
          className="px-2 py-1 rounded border"
          style={{ borderColor: "var(--brand-border)" }}
        >
          הוסף
        </button>
        <button
          type="button"
          disabled={loading || !selectedId}
          onClick={() => void run("remove")}
          className="px-2 py-1 rounded border text-red-600"
          style={{ borderColor: "var(--brand-border)" }}
        >
          הסר שותף
        </button>
      </div>
      {message && <p style={{ color: "var(--brand-text-muted)" }}>{message}</p>}
    </div>
  );
}
