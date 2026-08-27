import { listAdminAccounts } from "@/lib/admin/get-accounts";
import { requireAdminApi } from "@/lib/admin/require-admin";

export async function GET() {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  try {
    const items = await listAdminAccounts();
    return Response.json({ success: true, items });
  } catch (e) {
    console.error(e);
    return Response.json(
      { success: false, error: "Failed to list users" },
      { status: 500 }
    );
  }
}
