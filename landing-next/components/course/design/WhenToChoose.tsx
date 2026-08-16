"use client";

import { useState } from "react";

/** Inline disclosure — underline hover only, no card/outline chrome. */
export function WhenToChoose({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onKeyDown={(e) => e.stopPropagation()}
        className="hover-text-only text-xs text-primary font-semibold"
      >
        {open ? "הסתר הסבר" : "מתי כדאי לבחור?"}
      </button>
      {open && (
        <p
          className="mt-1 text-xs text-gray-500 leading-relaxed"
          onClick={(e) => e.stopPropagation()}
        >
          {text}
        </p>
      )}
    </div>
  );
}
