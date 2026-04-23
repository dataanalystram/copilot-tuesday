/**
 * CopilotKit v2 runtime endpoint, wired to local Ollama/Qwen.
 *
 * Uses createCopilotRuntimeHandler directly (no Hono wrapper) so that the
 * Next.js App Router catch-all handles path routing properly.
 *
 * The handler runs in "single-route" mode — the CopilotKit client
 * auto-detects transport and multiplexes all traffic over one POST endpoint.
 */

import { CopilotRuntime, BuiltInAgent, defineTool } from "@copilotkit/runtime/v2";
import { createCopilotRuntimeHandler } from "@copilotkit/runtime/v2";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { z } from "zod";

import { LLM_CONFIG, assertLlmConfig } from "@/lib/agent";
import { getMcpAppsConfig } from "@/lib/mcp-apps";
import { SYSTEM_PROMPT } from "@/lib/prompts";
import {
  getRepo,
  getContributors,
  getIssues,
  getCommitActivity,
  getStarTrend,
} from "@/lib/github";

assertLlmConfig();

const localLLM = createOpenAICompatible({
  name: "ollama",
  baseURL: LLM_CONFIG.baseUrl,
  apiKey: LLM_CONFIG.apiKey,
});

/* ------------------------------------------------------------------
 * Server-side tool catalog
 * ------------------------------------------------------------------ */

const tools = [
  defineTool({
    name: "github_repo",
    description: "Fetch basic stats for a GitHub repo: stars, forks, issues, last push.",
    parameters: z.object({ repo: z.string().describe("owner/name, e.g. vercel/next.js") }),
    execute: async ({ repo }) => getRepo(repo),
  }),
  defineTool({
    name: "github_contributors",
    description: "Top contributors with avatars and commit counts.",
    parameters: z.object({
      repo: z.string(),
      limit: z.number().int().min(1).max(20).default(5),
    }),
    execute: async ({ repo, limit }) => {
      const list = await getContributors(repo, limit);
      return list.map((c) => ({ login: c.login, contributions: c.contributions }));
    },
  }),
  defineTool({
    name: "github_issues",
    description: "Open/closed issues for the repo.",
    parameters: z.object({
      repo: z.string(),
      state: z.enum(["open", "closed", "all"]).default("open"),
      limit: z.number().int().min(1).max(20).default(5),
    }),
    execute: async ({ repo, state, limit }) => getIssues(repo, state, limit),
  }),
  defineTool({
    name: "github_commit_heatmap",
    description: "12 weeks × 7 days of quantized (0–4) commit activity.",
    parameters: z.object({ repo: z.string() }),
    execute: async ({ repo }) => ({ grid: await getCommitActivity(repo) }),
  }),
  defineTool({
    name: "github_star_trend",
    description: "Approximate monthly star trend for the last N months.",
    parameters: z.object({ repo: z.string(), months: z.number().int().min(3).max(36).default(12) }),
    execute: async ({ repo, months }) => ({ points: await getStarTrend(repo, months) }),
  }),
  defineTool({
    name: "project_file_tree",
    description:
      "List readable source files in this app so you can inspect the implementation before building a code evidence artifact.",
    parameters: z.object({
      limit: z.number().int().min(10).max(200).default(80),
    }),
    execute: async ({ limit }) => {
      const { listProjectFiles } = await import("@/lib/project-tools");
      return listProjectFiles(limit);
    },
  }),
  defineTool({
    name: "project_file_read",
    description:
      "Read one source/config/docs file from this app. Use this for code evidence and implementation audits.",
    parameters: z.object({
      path: z.string().describe("Project-relative path returned by project_file_tree."),
    }),
    execute: async ({ path }) => {
      const { readProjectFile } = await import("@/lib/project-tools");
      return readProjectFile(path);
    },
  }),
  defineTool({
    name: "python_data_profile",
    description:
      "Profile uploaded CSV/TSV/JSON text using a local Python data-analysis script. Returns columns, numeric summaries, categories, and chart recommendations.",
    parameters: z.object({
      filename: z.string(),
      content: z.string().max(1_500_000),
    }),
    execute: async ({ filename, content }) => {
      const { profileDataWithPython } = await import("@/lib/project-tools");
      return profileDataWithPython({ filename, content });
    },
  }),
  defineTool({
    name: "python_data_transform",
    description:
      "Run a local Python/Pandas analyst transform over uploaded CSV/TSV/JSON text. Use for cleaning, date parsing, aggregation, grouping, pivot-like summaries, chart conversion, table previews, and data-backed dashboard updates.",
    parameters: z.object({
      filename: z.string(),
      content: z.string().max(1_500_000),
      task: z.string().describe("User's requested operation, e.g. 'aggregate revenue by month and region as a line chart'."),
    }),
    execute: async ({ filename, content, task }) => {
      const { transformDataWithPython } = await import("@/lib/project-tools");
      const { setLatestTransform } = await import("@/lib/research-cache");
      const result = await transformDataWithPython({ filename, content, task });
      setLatestTransform(result as import("@/lib/research-cache").DataTransformResult);
      return result;
    },
  }),
  defineTool({
    name: "web_research_topic",
    description:
      "Search online for a broad topic and return sources plus chart-ready metrics, categories, and timeline data. Use for dashboards about companies, markets, products, public issues, technology trends, climate, finance, health, sports, or any non-GitHub topic.",
    parameters: z.object({
      query: z.string().describe("Specific research topic, e.g. 'global EV market trends' or 'AI adoption in healthcare'."),
    }),
    execute: async ({ query }) => {
      const { researchTopicOnline } = await import("@/lib/project-tools");
      const { setLatestResearch } = await import("@/lib/research-cache");
      const result = await researchTopicOnline(query);
      setLatestResearch(result);
      return result;
    },
  }),
  defineTool({
    name: "web_fetch_url",
    description:
      "Fetch and extract readable text from a user-provided HTTP(S) URL for internet grounding.",
    parameters: z.object({
      url: z.string().url(),
    }),
    execute: async ({ url }) => {
      const { fetchGroundingUrl } = await import("@/lib/project-tools");
      return fetchGroundingUrl(url);
    },
  }),
];

/* ------------------------------------------------------------------
 * Agent + runtime
 * ------------------------------------------------------------------ */

const defaultAgent = new BuiltInAgent({
  model: localLLM(LLM_CONFIG.model),
  prompt: SYSTEM_PROMPT,
  tools,
  maxSteps: 5,
  maxOutputTokens: 16384,
  temperature: 1,
  topP: 1,
  maxRetries: 1,
});

const runtime = new CopilotRuntime({
  agents: { default: defaultAgent },
  mcpApps: getMcpAppsConfig(),
});

const handler = createCopilotRuntimeHandler({
  runtime,
  basePath: "/api/copilotkit",
  mode: "single-route",
  cors: true,
});

export const GET = (req: Request) => handler(req);
export const POST = (req: Request) => handler(req);
