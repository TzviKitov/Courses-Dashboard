"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { LandingFollowupRow, RegistrationRow } from "@/lib/supabase/types";
import { Header, LockedNotice } from "./Form1Client";

interface Form3ClientProps {
  landingId: string;
  title: string;
  open: boolean;
  dueDate: string | null;
  items: RegistrationRow[];
  followup: LandingFollowupRow | null;
  token?: string;
  backHref: string;
}

export function Form3Client({
  landingId,
  title,
  open,
  dueDate,
  items,
  followup,
  token,
  backHref,
}: Form3ClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [generalFeedback, setGeneralFeedback] = useState(
    followup?.general_feedback ?? ""
  );
  const [courseNotes, setCourseNotes] = useState(followup?.form3_notes ?? "");
  const [rows, setRows] = useState(
    items.map((r) => ({
      id: r.id,
      full_name: r.full_name,
      placement_status: r.placement_status as boolean | null,
      placement_where: r.placement_where ?? "",
      form3_feedback: r.form3_feedback ?? "",
      form3_notes: r.form3_notes ?? "",
    }))
  );

  if (!open) {
    return (
      <LockedNotice title="טופס 3 — השמה" dueDate={dueDate} backHref={backHref} />
    );
  }

  const saveUrl = token
    ? `/api/forms/${token}/form3`
    : `/api/landings/${landingId}/followups/form3`;

  const save = () => {
    startTransition(async () => {
      setError("");
      setOk("");
      const r = await fetch(saveUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          general_feedback: generalFeedback,
          form3_notes: courseNotes,
          items: rows.map((row) => ({
            id: row.id,
            placement_status: row.placement_status,
            placement_where: row.placement_where,
            form3_feedback: row.form3_feedback,
            form3_notes: row.form3_notes,
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

  return (
    <div className="space-y-6">
      <Header
        title={`טופס 3 — ${title || "השמה"}`}
        subtitle="השמה לכל נרשם ומשוב כללי לקורס."
        backHref={backHref}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {ok && <p className="text-sm text-green-700">{ok}</p>}

      <section
        className="rounded-xl border p-4 space-y-3"
        style={{ borderColor: "var(--brand-border)", background: "var(--brand-surface)" }}
      >
        <h3 className="font-bold text-sm">משוב כללי (ברמת קורס)</h3>
        <textarea
          className="w-full text-sm border rounded p-2"
          rows={3}
          placeholder="משוב כללי"
          value={generalFeedback}
          onChange={(e) => setGeneralFeedback(e.target.value)}
          style={{ borderColor: "var(--brand-border)" }}
        />
        <textarea
          className="w-full text-sm border rounded p-2"
          rows={2}
          placeholder="הערות נוספות"
          value={courseNotes}
          onChange={(e) => setCourseNotes(e.target.value)}
          style={{ borderColor: "var(--brand-border)" }}
        />
      </section>

      <div className="space-y-3">
        <h3 className="font-bold text-sm">השמה לפי נרשם</h3>
        {rows.map((row, idx) => (
          <div
            key={row.id}
            className="rounded-xl border p-4 space-y-2"
            style={{
              borderColor: "var(--brand-border)",
              background: "var(--brand-surface)",
            }}
          >
            <p className="font-bold">{row.full_name}</p>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`place-${row.id}`}
                  checked={row.placement_status === true}
                  onChange={() =>
                    setRows((prev) => {
                      const next = [...prev];
                      next[idx] = { ...next[idx], placement_status: true };
                      return next;
                    })
                  }
                />
                השמה — כן
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`place-${row.id}`}
                  checked={row.placement_status === false}
                  onChange={() =>
                    setRows((prev) => {
                      const next = [...prev];
                      next[idx] = {
                        ...next[idx],
                        placement_status: false,
                        placement_where: "",
                      };
                      return next;
                    })
                  }
                />
                לא
              </label>
            </div>
            {row.placement_status === true && (
              <input
                className="w-full text-sm border rounded p-2"
                placeholder="לאן?"
                value={row.placement_where}
                onChange={(e) =>
                  setRows((prev) => {
                    const next = [...prev];
                    next[idx] = { ...next[idx], placement_where: e.target.value };
                    return next;
                  })
                }
                style={{ borderColor: "var(--brand-border)" }}
              />
            )}
            <textarea
              className="w-full text-sm border rounded p-2"
              rows={2}
              placeholder="משוב לנרשם"
              value={row.form3_feedback}
              onChange={(e) =>
                setRows((prev) => {
                  const next = [...prev];
                  next[idx] = { ...next[idx], form3_feedback: e.target.value };
                  return next;
                })
              }
              style={{ borderColor: "var(--brand-border)" }}
            />
            <textarea
              className="w-full text-sm border rounded p-2"
              rows={2}
              placeholder="הערות נוספות"
              value={row.form3_notes}
              onChange={(e) =>
                setRows((prev) => {
                  const next = [...prev];
                  next[idx] = { ...next[idx], form3_notes: e.target.value };
                  return next;
                })
              }
              style={{ borderColor: "var(--brand-border)" }}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={isPending}
        onClick={save}
        className="px-4 py-2 rounded-md text-white text-sm font-bold disabled:opacity-50 hover-nudge"
        style={{ background: "var(--brand-accent)" }}
      >
        {isPending ? "שומר..." : "שמור טופס 3"}
      </button>
    </div>
  );
}
