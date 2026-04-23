import { NextResponse } from "next/server";
import { getLatestTransform } from "@/lib/research-cache";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getLatestTransform() ?? { id: 0, result: null, createdAt: null });
}
