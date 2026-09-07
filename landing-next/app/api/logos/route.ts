import { NextResponse } from "next/server";
import { listLogosForPicker } from "@/lib/logos/library";

export const dynamic = "force-dynamic";

// GET /api/logos - Return logos library for course creators
export async function GET() {
  try {
    const logos = await listLogosForPicker();
    return NextResponse.json(logos);
  } catch (error) {
    console.error("Failed to load logos:", error);
    return NextResponse.json(
      { error: "Failed to load logos library" },
      { status: 500 }
    );
  }
}
