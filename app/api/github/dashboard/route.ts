import { NextResponse } from "next/server";

import { getCommitActivity, getContributors, getIssues, getRepo, getStarTrend } from "@/lib/github";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { repo?: string };
    const repo = body.repo?.trim() || "vercel/next.js";
    const [stats, contributors, commitGrid, issues, stars] = await Promise.all([
      getRepo(repo),
      getContributors(repo, 10),
      getCommitActivity(repo),
      getIssues(repo, "open", 5),
      getStarTrend(repo, 6),
    ]);
    return NextResponse.json({ repo: stats, contributors, commitGrid, issues, stars });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "GitHub dashboard failed" },
      { status: 500 },
    );
  }
}
