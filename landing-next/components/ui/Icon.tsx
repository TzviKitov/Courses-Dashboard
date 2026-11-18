interface IconProps {
  name: string;
  className?: string;
  /** 20px beside text, 24px in navigation. */
  size?: 20 | 24;
  hidden?: boolean;
}

export function Icon({ name, className = "", size = 24, hidden = true }: IconProps) {
  return (
    <span
      className={`material-symbols-rounded ${className}`}
      style={{ fontSize: size }}
      aria-hidden={hidden ? true : undefined}
    >
      {name}
    </span>
  );
}
