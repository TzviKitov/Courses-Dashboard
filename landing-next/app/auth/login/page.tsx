import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";
import { sanitizeRedirectPath } from "@/lib/auth/guards";

export const metadata = {
  title: "התחברות | CourseFlow",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    redirect?: string;
    error?: string;
    message?: string;
    disabled?: string;
    idle?: string;
  }>;
}) {
  const params = await searchParams;
  const redirect = sanitizeRedirectPath(params.redirect || "/dashboard");
  const notice = params.disabled
    ? "החשבון הושבת. פנו למנהל המערכת."
    : params.idle
      ? "הסשן הסתיים עקב חוסר פעילות. התחברו שוב בסיסמה או Google — במכשיר זה אין צורך באימות נוסף עד תום 20 הימים."
      : null;

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
        <h1
          className="text-2xl font-bold mb-1"
          style={{ color: "var(--brand-text)" }}
        >
          התחברות
        </h1>
        <p className="text-sm mb-6" style={{ color: "var(--brand-text-muted)" }}>
          מדריכים — מייל וסיסמה או Google, ואז קוד SMS לנייד.
          מנהלים — מייל וסיסמה או Google, ואז אפליקציית אימות.
        </p>

        {params.error && (
          <p className="mb-4 text-sm text-red-600" role="alert">
            {params.error}
          </p>
        )}
        {params.message && (
          <p className="mb-4 text-sm" style={{ color: "var(--brand-accent)" }}>
            {params.message}
          </p>
        )}

        <LoginForm redirectTo={redirect} notice={notice} />

        <p
          className="mt-6 text-center text-sm"
          style={{ color: "var(--brand-text-muted)" }}
        >
          מדריך חדש?{" "}
          <Link
            href={`/auth/register?redirect=${encodeURIComponent(redirect)}`}
            className="font-medium underline"
            style={{ color: "var(--brand-accent)" }}
          >
            הרשמה
          </Link>
        </p>
      </div>
    </main>
  );
}
