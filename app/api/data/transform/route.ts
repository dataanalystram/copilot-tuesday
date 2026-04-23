import { NextResponse } from "next/server";

import { transformDataWithPython } from "@/lib/project-tools";
import { setLatestTransform, type DataTransformResult } from "@/lib/research-cache";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      filename?: string;
      content?: string;
      task?: string;
    };
    const filename = body.filename?.trim() || "data.csv";
    const content = body.content ?? "";
    const task = body.task?.trim() || "profile and chart this dataset";

    if (!content.trim()) {
      return NextResponse.json({ error: "content is required" }, { status: 400 });
    }

    const result = (await transformDataWithPython({
      filename,
      content,
      task,
    })) as DataTransformResult;

    setLatestTransform(result);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Data transform failed" },
      { status: 500 },
    );
  }
}
