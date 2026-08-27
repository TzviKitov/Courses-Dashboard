import Link from "next/link";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { sanitizeRedirectPath } from "@/lib/auth/guards";

export const metadata = {
  title: "הרשמת מדריך | CourseFlow",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string }>;
}) {
  const params = await searchParams;
  const redirect = sanitizeRedirectPath(params.redirect || "/dashboard/my");

  return (
    <main
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--brand-bg, #f8fafc)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl border p-6 shadow-sm"
        style={{
          background: "var(--brand-surface, #fff)",
          borderColor: "var(--brand-border, #e2e8f0)",
        }}
      >
        <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--brand-text)" }}>
          הרשמת מדריך
        </h1>
        <p className="text-sm mb-6" style={{ color: "var(--brand-text-muted)" }}>
          שם משתמש, אימייל וסיסמה חזקה — ואז אישור מנהל
        </p>
        {params.error && (
          <p className="mb-4 text-sm text-red-600" role="alert">
            {params.error}
          </p>
        )}
        <RegisterForm redirectTo={redirect} />
        <p className="mt-6 text-center text-sm" style={{ color: "var(--brand-text-muted)" }}>
          כבר רשום?{" "}
          <Link
            href={`/auth/login?redirect=${encodeURIComponent(redirect)}`}
            className="font-medium underline"
            style={{ color: "var(--brand-accent)" }}
          >
            התחברות
          </Link>
        </p>
      </div>
    </main>
  );
}
