import { CREATE_WIZARD_STEPS } from "@/lib/course/create-wizard";

export function CreateWizardProgress({ step }: { step: 1 | 2 | 3 | 4 }) {
  const total = CREATE_WIZARD_STEPS.length;
  const current = CREATE_WIZARD_STEPS[step - 1];
  const percent = Math.round((step / total) * 100);

  return (
    <div className="mb-10 max-w-4xl mx-auto">
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-end gap-3">
          <div>
            <p className="text-lg font-bold" style={{ color: "var(--brand-text)" }}>
              יצירת קורס חדש
            </p>
            <p className="text-sm" style={{ color: "var(--brand-text-muted)" }}>
              שלב {step} מתוך {total}: {current.label}
            </p>
          </div>
          <span
            className="text-sm font-bold tabular-nums"
            style={{ color: "var(--brand-accent)" }}
          >
            {percent}%
          </span>
        </div>
        <div
          className="h-2 w-full rounded-full overflow-hidden"
          style={{ background: "var(--brand-accent-soft)" }}
        >
          <div
            className="h-full rounded-full transition-[width] duration-300"
            style={{ width: `${percent}%`, background: "var(--brand-accent)" }}
          />
        </div>
        <ol className="hidden sm:flex justify-between gap-2 text-[11px] font-medium">
          {CREATE_WIZARD_STEPS.map((item) => (
            <li
              key={item.id}
              className="min-w-0 truncate"
              style={{
                color:
                  item.id === step
                    ? "var(--brand-accent)"
                    : item.id < step
                      ? "var(--brand-text)"
                      : "var(--brand-text-muted)",
              }}
            >
              {item.id}. {item.label}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
