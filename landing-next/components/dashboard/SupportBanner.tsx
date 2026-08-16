/**
 * Floating support balloon — fixed under the header on the physical left,
 * capped at ~1/4 of the viewport width so it stays a quiet corner cue.
 */
export function SupportBanner() {
  return (
    <aside
      className="fixed z-30 left-3 top-[4.75rem] w-[min(13rem,25vw)] max-sm:w-[min(11rem,42vw)] pointer-events-none"
      aria-label="תמיכה רגשית"
    >
      <div
        className="pointer-events-auto relative rounded-2xl border px-2.5 py-2"
        style={{
          background:
            "linear-gradient(160deg, var(--brand-accent-soft) 0%, var(--brand-surface) 70%)",
          borderColor: "var(--brand-border)",
          boxShadow: "var(--brand-shadow-elevated)",
        }}
      >
        <span
          className="absolute -top-1.5 left-5 w-2.5 h-2.5 rotate-45 border-l border-t"
          style={{
            background: "var(--brand-accent-soft)",
            borderColor: "var(--brand-border)",
          }}
          aria-hidden
        />

        <p
          className="relative text-[11px] leading-snug m-0"
          style={{ color: "var(--brand-text)" }}
        >
          מרגישים לבד? רוצים לדבר עם מישהו?
          <span className="mt-0.5 flex items-center gap-1.5">
            <span
              className="inline-flex shrink-0 w-6 h-6 rounded-lg items-center justify-center"
              style={{
                background: "var(--brand-surface)",
                color: "var(--brand-accent)",
                boxShadow: "var(--brand-shadow)",
              }}
              aria-hidden
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                handshake
              </span>
            </span>
            <a
              href="https://maanebareshet.co.il/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold underline underline-offset-2 decoration-2 hover-wiggle"
              style={{ color: "var(--brand-accent)" }}
            >
              מענה ברשת
            </a>
          </span>
        </p>
      </div>
    </aside>
  );
}
