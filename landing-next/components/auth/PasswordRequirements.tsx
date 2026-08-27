"use client";

import { useMemo, useState } from "react";
import {
  PASSWORD_REQUIREMENTS,
  validatePassword,
} from "@/lib/auth/password";

export function PasswordRequirements({ password }: { password: string }) {
  const results = useMemo(
    () =>
      PASSWORD_REQUIREMENTS.map((r) => ({
        ...r,
        ok: r.test(password),
      })),
    [password]
  );

  return (
    <ul className="mt-2 space-y-1 text-xs" aria-live="polite">
      {results.map((r) => (
        <li
          key={r.id}
          style={{ color: r.ok ? "var(--brand-accent)" : "var(--brand-text-muted)" }}
        >
          {r.ok ? "✓" : "○"} {r.label}
        </li>
      ))}
    </ul>
  );
}

export function usePasswordField() {
  const [password, setPassword] = useState("");
  const validation = useMemo(() => validatePassword(password), [password]);
  return { password, setPassword, validation };
}
