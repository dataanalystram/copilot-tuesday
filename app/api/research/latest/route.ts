import { NextResponse } from "next/server";
import { getLatestResearch } from "@/lib/research-cache";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getLatestResearch() ?? { id: 0, result: null, createdAt: null });
}
