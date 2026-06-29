import { getLandingById } from "@/lib/landings/get-landing";

// GET /api/landing/[id]
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const landing = await getLandingById(id);

  if (!landing) {
    return new Response("Not Found", { status: 404 });
  }

  return Response.json(landing);
}
