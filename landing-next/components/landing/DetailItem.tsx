import { Icon } from "@/components/ui/Icon";

interface DetailItemProps {
  icon: string;
  label: string;
  value: string;
}

export function DetailItem({ icon, label, value }: DetailItemProps) {
  return (
    <div
      className="flex items-start gap-3 rounded-2xl p-4"
      style={{
        background: "var(--color-bg)",
        border: "1px solid color-mix(in srgb, var(--primary) 14%, var(--color-border))",
      }}
    >
      <div
        aria-hidden
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{
          backgroundColor: "color-mix(in srgb, var(--primary) 14%, var(--color-surface))",
        }}
      >
        <Icon name={icon} className="text-xl text-course" />
      </div>
      <div className="min-w-0 pt-0.5">
        <p className="text-sm font-semibold text-[var(--color-text)]">{label}</p>
        <p className="mt-0.5 break-words leading-relaxed text-[var(--color-text-muted)]">
          {value}
        </p>
      </div>
    </div>
  );
}
