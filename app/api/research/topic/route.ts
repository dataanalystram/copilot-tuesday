import { NextResponse } from "next/server";

import { researchTopicOnline } from "@/lib/project-tools";
import { setLatestResearch } from "@/lib/research-cache";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { query?: string };
    const result = await researchTopicOnline(body.query?.trim() || "global EV market trends");
    setLatestResearch(result);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Research failed" },
      { status: 500 },
    );
  }
}
