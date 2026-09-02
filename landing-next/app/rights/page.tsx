"use client";

import { useState } from "react";
import Link from "next/link";
import { SiteFooter } from "@/components/privacy/SiteFooter";
import { normalizeIsraeliPhone } from "@/lib/auth/phone";

export default function RightsPage() {
  const [type, setType] = useState("access");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [details, setDetails] = useState("");
  const [status, setStatus] = useState<"idle" | "ok" | "err">("idle");
  const [error, setError] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const phoneNorm = phone.trim() ? normalizeIsraeliPhone(phone) : null;
    const res = await fetch("/api/privacy/data-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestType: type,
        fullName: fullName.trim(),
        email: email.trim() || null,
        phone: phoneNorm || phone.trim() || null,
        details: details.trim(),
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "השליחה נכשלה");
      setStatus("err");
      return;
    }
    setStatus("ok");
  };

  if (status === "ok") {
    return (
      <main className="max-w-lg mx-auto px-4 py-12" dir="rtl">
        <h1 className="text-2xl font-bold mb-2">הבקשה התקבלה</h1>
        <p className="text-sm text-gray-600">
          נטפל בבקשה לאחר זיהוי המבקש. ניצור קשר בפרטים שמסרתם.
        </p>
        <SiteFooter />
      </main>
    );
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-12" dir="rtl">
      <h1 className="text-2xl font-bold mb-2">מימוש זכויות (עיון / תיקון / מחיקה)</h1>
      <p className="text-sm text-gray-600 mb-6">
        לפי סעיפים 13–14 לחוק הגנת הפרטיות. הורה של קטין רשאי להגיש בשמו.{" "}
        <Link href="/privacy" className="underline">
          מדיניות פרטיות
        </Link>
      </p>
      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block text-sm">
          סוג בקשה
          <select
            className="mt-1 w-full h-11 border rounded-lg px-3"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="access">עיון במידע</option>
            <option value="rectify">תיקון</option>
            <option value="erase">מחיקה</option>
            <option value="other">אחר</option>
          </select>
        </label>
        <label className="block text-sm">
          שם מלא
          <input
            required
            className="mt-1 w-full h-11 border rounded-lg px-3"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          אימייל
          <input
            type="email"
            className="mt-1 w-full h-11 border rounded-lg px-3"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          טלפון
          <input
            className="mt-1 w-full h-11 border rounded-lg px-3"
            dir="ltr"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          פירוט
          <textarea
            className="mt-1 w-full border rounded-lg px-3 py-2"
            rows={4}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          className="w-full h-12 rounded-xl bg-gray-900 text-white font-bold"
        >
          שלח בקשה
        </button>
      </form>
      <SiteFooter />
    </main>
  );
}
