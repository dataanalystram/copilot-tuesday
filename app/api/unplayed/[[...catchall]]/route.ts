import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { LangGraphHttpAgent } from "@copilotkit/runtime/langgraph";
import { NextRequest, NextResponse } from "next/server";

const AGENT_URL = process.env.UNPLAYED_AGENT_URL ?? "http://localhost:8123";

const serviceAdapter = new ExperimentalEmptyAdapter();

const runtime = new CopilotRuntime({
  agents: {
    unplayed: new LangGraphHttpAgent({ url: AGENT_URL }),
  },
});

export const POST = async (req: NextRequest) => {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter,
    endpoint: "/api/unplayed",
  });
  return handleRequest(req);
};

export const GET = async () => {
  try {
    const res = await fetch(`${AGENT_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    const body = res.ok ? await res.json() : null;
    return NextResponse.json({ agent_url: AGENT_URL, agent: body ?? "unreachable" });
  } catch {
    return NextResponse.json({ agent_url: AGENT_URL, agent: "unreachable" });
  }
};
