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
    <>
      <CreateFlowHeader signInReturnTo={pathname} />
      {children}
    </>
  );
}
