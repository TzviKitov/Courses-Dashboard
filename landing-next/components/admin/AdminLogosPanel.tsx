"use client";

import { useCallback, useEffect, useState } from "react";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { useToast } from "@/components/ui/Toast";

interface LogoRow {
  id: string;
  name: string;
  url: string;
  tags: string[];
}

export function AdminLogosPanel() {
  const { toast } = useToast();
  const [items, setItems] = useState<LogoRow[]>([]);
  const [source, setSource] = useState<"db" | "static">("static");
  const [tableMissing, setTableMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [tags, setTags] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const canMutate = source === "db" && !tableMissing;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/logos");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "שגיאה");
      setItems(
        (body.items ?? []).map((row: LogoRow) => ({
          ...row,
          tags: Array.isArray(row.tags) ? row.tags : [],
        }))
      );
      setSource(body.source === "db" ? "db" : "static");
      setTableMissing(Boolean(body.tableMissing));
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const addLogo = async () => {
    if (!file || !name.trim()) {
      toast("יש למלא שם ולבחור קובץ.", "error");
      return;
    }
    setSaving(true);
    try {
      const form = new FormData();
      form.set("name", name.trim());
      form.set("tags", tags.trim());
      form.set("file", file);
      const res = await fetch("/api/admin/logos", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) {
        toast(body.error || "העלאה נכשלה", "error");
        if (body.tableMissing) setTableMissing(true);
        return;
      }
      setName("");
      setTags("");
      setFile(null);
      setFileKey((k) => k + 1);
      toast("הלוגו נוסף לספרייה", "success");
      await load();
    } catch {
      toast("העלאה נכשלה", "error");
    } finally {
      setSaving(false);
    }
  };

  const removeLogo = async (logo: LogoRow) => {
    if (!confirm(`להסיר את "${logo.name}" מהספרייה? יוצרי קורסים לא יוכלו לבחור אותו יותר.`)) {
      return;
    }
    setRemovingId(logo.id);
    try {
      const res = await fetch(`/api/admin/logos/${encodeURIComponent(logo.id)}`, {
        method: "DELETE",
      });
      const body = await res.json();
      if (!res.ok) {
        toast(body.error || "ההסרה נכשלה", "error");
        return;
      }
      toast("הלוגו הוסר", "success");
      await load();
    } catch {
      toast("ההסרה נכשלה", "error");
    } finally {
      setRemovingId(null);
    }
  };

  if (loading) {
    return (
      <p className="text-sm" style={{ color: "var(--brand-text-muted)" }}>
        טוען...
      </p>
    );
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  return (
    <div className="space-y-8">
      {tableMissing && (
        <p
          className="text-sm rounded-xl border px-4 py-3"
          style={{
            borderColor: "var(--brand-border)",
            background: "var(--brand-accent-soft)",
            color: "var(--brand-text)",
          }}
        >
          כדי להוסיף או להסיר לוגואים יש להריץ את הקובץ{" "}
          <code className="text-xs" dir="ltr">
            db/schema-logos.sql
          </code>{" "}
          בעורך SQL של Supabase.
        </p>
      )}
      {!canMutate && !tableMissing && (
        <p className="text-sm" style={{ color: "var(--brand-text-muted)" }}>
          הספרייה מוצגת מקובץ מקומי לקריאה בלבד. ניהול מלא זמין כשמסד הנתונים פעיל.
        </p>
      )}

      <section
        className="rounded-2xl border p-4 space-y-3"
        style={{ borderColor: "var(--brand-border)" }}
      >
        <h2 className="font-bold" style={{ color: "var(--brand-text)" }}>
          הוספת לוגו
        </h2>
        <p className="text-sm" style={{ color: "var(--brand-text-muted)" }}>
          הלוגו יופיע בספרייה שיוצרי קורסים בוחרים ממנה לבאנר ולדף הנחיתה.
        </p>
        <div className="flex flex-wrap gap-2 items-end">
          <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--brand-text-muted)" }}>
            שם
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canMutate || saving}
              placeholder="למשל עיריית ירושלים"
              className="h-10 px-3 rounded-lg border text-sm min-w-48"
              style={{ borderColor: "var(--brand-border)", color: "var(--brand-text)" }}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--brand-text-muted)" }}>
            תגיות (מופרדות בפסיק)
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              disabled={!canMutate || saving}
              placeholder="חינוך, נוער"
              className="h-10 px-3 rounded-lg border text-sm min-w-48"
              style={{ borderColor: "var(--brand-border)", color: "var(--brand-text)" }}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--brand-text-muted)" }}>
            קובץ
            <input
              type="file"
              key={fileKey}
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              disabled={!canMutate || saving}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="h-10 text-sm file:me-2 file:h-10 file:px-3 file:rounded-lg file:border file:text-sm"
            />
          </label>
          <button
            type="button"
            onClick={() => void addLogo()}
            disabled={!canMutate || saving}
            className="h-10 px-4 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
            style={{ background: "var(--brand-accent)" }}
          >
            {saving ? "מעלה..." : "הוסף לוגו"}
          </button>
        </div>
      </section>

      {items.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--brand-text-muted)" }}>
          אין לוגואים בספרייה. הוסיפו לוגו כדי שיוצרי קורסים יוכלו לבחור אותו.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((logo) => (
            <article
              key={logo.id}
              className="rounded-2xl border p-4 flex flex-col gap-3"
              style={{
                borderColor: "var(--brand-border)",
                background: "var(--brand-surface)",
              }}
            >
              <div
                className="relative h-20 rounded-lg overflow-hidden"
                style={{ background: "#f8fafc" }}
              >
                <OptimizedImage
                  src={logo.url}
                  alt={logo.name}
                  fill
                  sizes="280px"
                  className="object-contain p-2"
                />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold truncate" style={{ color: "var(--brand-text)" }}>
                  {logo.name}
                </h3>
                {logo.tags.length > 0 && (
                  <p className="text-xs mt-0.5" style={{ color: "var(--brand-text-muted)" }}>
                    {logo.tags.join(" · ")}
                  </p>
                )}
              </div>
              <button
                type="button"
                disabled={!canMutate || removingId === logo.id}
                className="text-sm text-red-600 text-right disabled:opacity-50"
                onClick={() => void removeLogo(logo)}
              >
                {removingId === logo.id ? "מסיר..." : "הסר מהספרייה"}
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
