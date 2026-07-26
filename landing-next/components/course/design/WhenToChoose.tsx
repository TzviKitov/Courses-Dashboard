"use client";

import { useState } from "react";

export function WhenToChoose({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-primary font-semibold hover:underline"
      >
        {open ? "הסתר הסבר" : "מתי כדאי לבחור?"}
      </button>
      {open && (
        <p className="mt-1 text-xs text-gray-500 leading-relaxed">{text}</p>
      )}
    </div>
  );
}
