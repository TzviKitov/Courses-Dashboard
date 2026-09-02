"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type {
  CompletionStatus,
  LandingFollowupRow,
  RegistrationRow,
} from "@/lib/supabase/types";
import { Header, LockedNotice } from "./Form1Client";
import { NotesGuidance } from "@/components/privacy/NotesGuidance";

interface Form2ClientProps {
  landingId: string;
  title: string;
  open: boolean;
  dueDate: string | null;
  items: RegistrationRow[];
  followup: LandingFollowupRow | null;
  token?: string;
  backHref: string;
}

export function Form2Client({
  landingId,
  title,
  open,
  dueDate,
  items,
  followup,
  token,
  backHref,
}: Form2ClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [professionalism, setProfessionalism] = useState<number | null>(
    followup?.professionalism_rating ?? null
  );
  const [audienceFit, setAudienceFit] = useState<number | null>(
    followup?.audience_fit_rating ?? null
  );
  const [audienceText, setAudienceText] = useState(
    followup?.audience_fit_text ?? ""
  );
  const [courseNotes, setCourseNotes] = useState(followup?.form2_notes ?? "");
  const [rows, setRows] = useState(
    items.map((r) => ({
      id: r.id,
      full_name: r.full_name,
      completion_status: r.completion_status as CompletionStatus | null,
      form2_notes: r.form2_notes ?? "",
    }))
  );

  if (!open) {
    return (
      <LockedNotice title="טופס 2 — סיום קורס" dueDate={dueDate} backHref={backHref} />
    );
  }

  const saveUrl = token
    ? `/api/forms/${token}/form2`
    : `/api/landings/${landingId}/followups/form2`;

  const save = () => {
    startTransition(async () => {
      setError("");
      setOk("");
      const r = await fetch(saveUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          professionalism_rating: professionalism,
          audience_fit_rating: audienceFit,
          audience_fit_text: audienceText,
          form2_notes: courseNotes,
          items: rows.map((row) => ({
            id: row.id,
            completion_status: row.completion_status,
            form2_notes: row.form2_notes,
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
        title={`טופס 2 — ${title || "סיום"}`}
        subtitle="דירוג ספק וסטטוס סיום לכל נרשם."
        backHref={backHref}
      />
      <NotesGuidance />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {ok && <p className="text-sm text-green-700">{ok}</p>}

      <section
        className="rounded-xl border p-4 space-y-3"
        style={{ borderColor: "var(--brand-border)", background: "var(--brand-surface)" }}
      >
        <h3 className="font-bold text-sm" style={{ color: "var(--brand-text)" }}>
          חוות דעת ספק (ברמת קורס)
        </h3>
        <RatingRow
          label="עד כמה היה מקצועי? (1–5)"
          value={professionalism}
          onChange={setProfessionalism}
        />
        <RatingRow
          label="עד כמה מותאם לקהל היעד? (1–5)"
          value={audienceFit}
          onChange={setAudienceFit}
        />
        <textarea
          className="w-full text-sm border rounded p-2"
          rows={2}
          placeholder="התאמה לקהל היעד — טקסט חופשי"
          value={audienceText}
          onChange={(e) => setAudienceText(e.target.value)}
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
        <h3 className="font-bold text-sm" style={{ color: "var(--brand-text)" }}>
          מי סיים / נשר
        </h3>
        {rows.map((row, idx) => (
          <div
            key={row.id}
            className="rounded-xl border p-4"
            style={{
              borderColor: "var(--brand-border)",
              background: "var(--brand-surface)",
            }}
          >
            <p className="font-bold mb-2">{row.full_name}</p>
            <div className="flex gap-4 mb-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`comp-${row.id}`}
                  checked={row.completion_status === "completed"}
                  onChange={() =>
                    setRows((prev) => {
                      const next = [...prev];
                      next[idx] = { ...next[idx], completion_status: "completed" };
                      return next;
                    })
                  }
                />
                סיים
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`comp-${row.id}`}
                  checked={row.completion_status === "dropped"}
                  onChange={() =>
                    setRows((prev) => {
                      const next = [...prev];
                      next[idx] = { ...next[idx], completion_status: "dropped" };
                      return next;
                    })
                  }
                />
                נשר
              </label>
            </div>
            <textarea
              className="w-full text-sm border rounded p-2"
              rows={2}
              placeholder="הערות נוספות"
              value={row.form2_notes}
              onChange={(e) =>
                setRows((prev) => {
                  const next = [...prev];
                  next[idx] = { ...next[idx], form2_notes: e.target.value };
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
        {isPending ? "שומר..." : "שמור טופס 2"}
      </button>
    </div>
  );
}

function RatingRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <p className="text-xs mb-1" style={{ color: "var(--brand-text-muted)" }}>
        {label}
      </p>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className="w-9 h-9 rounded-md border text-sm font-bold hover-chip"
            style={{
              borderColor: "var(--brand-border)",
              background: value === n ? "var(--brand-accent)" : "transparent",
              color: value === n ? "#fff" : "var(--brand-text)",
            }}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
