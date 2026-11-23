"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/Toast";

export interface EditCourseValues {
  title: string;
  description: string;
  extendedDescription: string;
  faqText: string;
  syllabusText: string;
  location: string;
  duration: string;
  ageRange: string;
  instructorName: string;
  organization: string;
  role: string;
  contactPhone: string;
  contactEmail: string;
  startDate: string;
  endDate: string;
  interviewDate: string;
  time: string;
  days: string;
  price: string;
  paymentLink: string;
  requiresInterview: boolean;
  hidden: boolean;
}

const inputClass =
  "w-full h-12 px-4 rounded-lg border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-course focus:border-transparent outline-none transition-all placeholder:text-gray-400";
const areaClass =
  "w-full p-4 rounded-lg border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-course focus:border-transparent outline-none transition-all placeholder:text-gray-400";

export function EditCourseForm({
  landingId,
  initial,
  hiddenLocked,
}: {
  landingId: string;
  initial: EditCourseValues;
  /** Courses for guides are always hidden. */
  hiddenLocked: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [v, setV] = useState<EditCourseValues>(initial);
  const [isPending, startTransition] = useTransition();

  const set = <K extends keyof EditCourseValues>(key: K, value: EditCourseValues[K]) =>
    setV((prev) => ({ ...prev, [key]: value }));

  const field = (
    key: keyof EditCourseValues,
    label: string,
    opts: { type?: string; ltr?: boolean; required?: boolean } = {}
  ) => (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-gray-900">{label}</span>
      <input
        type={opts.type ?? "text"}
        value={String(v[key])}
        onChange={(e) => set(key, e.target.value as never)}
        dir={opts.ltr ? "ltr" : undefined}
        required={opts.required}
        className={inputClass}
      />
    </label>
  );

  const area = (
    key: keyof EditCourseValues,
    label: string,
    rows: number,
    hint?: string
  ) => (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-gray-900">{label}</span>
      {hint && <span className="text-xs text-gray-500">{hint}</span>}
      <textarea
        rows={rows}
        value={String(v[key])}
        onChange={(e) => set(key, e.target.value as never)}
        className={areaClass}
      />
    </label>
  );

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        const r = await fetch(`/api/landings/${landingId}/details`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...v,
            price: v.price.trim() === "" ? null : Number(v.price),
          }),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok || !data.success) throw new Error(data.error || "השמירה נכשלה");
        toast("השינויים נשמרו", "success");
        router.push(`/dashboard/my/${landingId}`);
        router.refresh();
      } catch (err) {
        toast(err instanceof Error ? err.message : "השמירה נכשלה", "error");
      }
    });
  };

  const toggle = (
    key: "requiresInterview",
    label: string,
    hint: string
  ) => (
    <label className="flex items-start gap-3">
      <input
        type="checkbox"
        checked={v[key]}
        onChange={(e) => set(key, e.target.checked)}
        className="mt-1 h-5 w-5"
      />
      <span>
        <span className="block text-sm font-semibold text-gray-900">{label}</span>
        <span className="block text-xs text-gray-500">{hint}</span>
      </span>
    </label>
  );

  return (
    <form onSubmit={save} className="space-y-6 max-w-3xl">
      <section className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
        <h2 className="text-base font-bold text-gray-900">פרטי הקורס</h2>
        {field("title", "שם הקורס", { required: true })}
        {area("description", "תיאור קצר", 3)}
        {area(
          "extendedDescription",
          "מידע נוסף על הקורס",
          6,
          "שורה שמסתיימת בנקודתיים היא כותרת, ושורות שמתחילות ב־• יופיעו כמשבצות"
        )}
        {area("faqText", "שאלות נפוצות", 5)}
        {area("syllabusText", "סילבוס / שלבי התכנית", 5)}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
        <h2 className="text-base font-bold text-gray-900">מתי ואיפה</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field("startDate", "תאריך פתיחה", { type: "date", ltr: true })}
          {field("endDate", "תאריך סיום", { type: "date", ltr: true })}
          {field("interviewDate", "תאריך ראיונות", { type: "date", ltr: true })}
          {field("time", "שעות")}
          {field("days", "ימים")}
          {field("duration", "משך")}
          {field("location", "מיקום")}
          {field("ageRange", "טווח גילאים")}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
        <h2 className="text-base font-bold text-gray-900">איש קשר ותשלום</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field("instructorName", "שם המדריך")}
          {field("role", "תפקיד")}
          {field("organization", "ארגון")}
          {field("contactPhone", "טלפון", { type: "tel", ltr: true })}
          {field("contactEmail", "מייל", { type: "email", ltr: true })}
          {field("price", "מחיר (ש״ח)", { type: "number", ltr: true })}
        </div>
        {field("paymentLink", "לינק תשלום", { type: "url", ltr: true })}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
        <h2 className="text-base font-bold text-gray-900">הרשמה ופרסום</h2>
        {toggle(
          "requiresInterview",
          "נדרש ראיון קבלה",
          "יתווסף שדה זמינות לראיון בטופס ההרשמה"
        )}
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={!v.hidden && !hiddenLocked}
            disabled={hiddenLocked}
            onChange={(e) => set("hidden", !e.target.checked)}
            className="mt-1 h-5 w-5"
          />
          <span>
            <span className="block text-sm font-semibold text-gray-900">הצגה בגלריה</span>
            <span className="block text-xs text-gray-500">
              {hiddenLocked
                ? "קורס למדריכים אף פעם לא מופיע בגלריה."
                : "כשזה כבוי הקורס לא מופיע בגלריה, ומי שיש לו את הקישור יכול להיכנס ולהירשם."}
            </span>
          </span>
        </label>
      </section>

      <p className="text-xs text-gray-500">
        תמונת הבאנר ותמונת הרקע לא משתנות כאן. אפשר להוריד אותן מעמוד הניהול.
      </p>

      <div className="flex gap-3">
        <button type="submit" disabled={isPending} className="av-btn av-btn-primary disabled:opacity-50">
          {isPending ? "שומר..." : "שמור שינויים"}
        </button>
        <button
          type="button"
          onClick={() => router.push(`/dashboard/my/${landingId}`)}
          className="px-6 h-12 rounded-lg border border-gray-200 text-gray-500 font-medium"
        >
          ביטול
        </button>
      </div>
    </form>
  );
}
