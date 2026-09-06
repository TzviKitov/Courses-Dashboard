import { headers } from "next/headers";
import { CreateFlowHeader } from "@/components/navigation/CreateFlowHeader";
import { assertPageAccess } from "@/lib/auth/guards";

export default async function CreateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "/create";
  await assertPageAccess(pathname);

  return (
    <div
      data-theme="management"
      className="min-h-screen"
      style={{ background: "var(--brand-page-bg)", color: "var(--brand-text)" }}
    >
      <div
        className="min-h-8 px-4 flex items-center justify-center text-center text-sm font-semibold text-white"
        style={{ background: "var(--brand-accent)" }}
      >
        מצב ניהול פנימי · יצירת קורס
      </div>
      <CreateFlowHeader signInReturnTo={pathname} />
      {children}
    </div>
  );
}
