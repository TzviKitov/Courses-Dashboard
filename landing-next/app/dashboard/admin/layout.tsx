import { headers } from "next/headers";
import { assertPageAccess } from "@/lib/auth/guards";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = (await headers()).get("x-pathname") ?? "/dashboard/admin";
  await assertPageAccess(pathname);
  return children;
}
