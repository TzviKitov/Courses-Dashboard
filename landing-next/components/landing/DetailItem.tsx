import { Icon } from "@/components/ui/Icon";

interface DetailItemProps {
  icon: string;
  label: string;
  value: string;
}

export function DetailItem({ icon, label, value }: DetailItemProps) {
  return (
    <div
      className="flex items-start gap-4 rounded-xl border p-4"
      style={{
        borderColor: "color-mix(in srgb, var(--primary) 22%, #e5e7eb)",
        backgroundColor: "color-mix(in srgb, var(--primary) 8%, white)",
      }}
    >
      <div
        aria-hidden
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{
          backgroundColor: "color-mix(in srgb, var(--primary) 16%, white)",
        }}
      >
        <Icon name={icon} className="text-xl text-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-gray-500">{label}</p>
        <p className="font-semibold break-words text-gray-900">{value}</p>
      </div>
    </div>
  );
}
