/**
 * Probe: can the model emit a valid multi-widget MorphBoard tree?
 *
 * This uses the same local Ollama settings as Studio, but asks for the full
 * SurfaceMeta shape and validates against the zod schema from
 * lib/agent-state.ts (inline here to avoid the tsx path resolver).
 *
 * Run after probe:ollama passes:
 *   npm run probe:a2ui
 */

import { config } from "dotenv";
import OpenAI from "openai";
import { z } from "zod";

config({ path: ".env.local" });
config();

const client = new OpenAI({
  apiKey: process.env.OLLAMA_API_KEY ?? "ollama",
  baseURL: `${(process.env.OLLAMA_BASE_URL ?? "http://localhost:11434").replace(/\/$/, "")}/v1`,
  timeout: 90_000,
});

const NodeSchema: z.ZodType<any> = z.lazy(() =>
  z.union([
    z.object({ type: z.literal("Column"), gap: z.number().optional(), children: z.array(NodeSchema) }),
    z.object({ type: z.literal("Row"), gap: z.number().optional(), children: z.array(NodeSchema) }),
    z.object({ type: z.literal("Text"), text: z.string() }),
    z.object({ type: z.literal("Component"), name: z.string(), props: z.record(z.string(), z.unknown()) }),
  ]),
);
const SurfaceSchema = z.object({
  id: z.string(),
  w: z.number().int().min(3).max(12),
  h: z.number().int().min(1).max(6),
  tree: NodeSchema,
});

const WIDGET_NAMES = new Set(["Kpi", "LineChart", "BarChart", "Heatmap", "Contributors", "Issues", "Markdown", "Globe"]);

function normalizeNode(node: any): any {
  if (!node || typeof node !== "object") return node;
  if (WIDGET_NAMES.has(node.type)) {
    return {
      type: "Component",
      name: node.type,
      props: node.props ?? Object.fromEntries(Object.entries(node).filter(([key]) => key !== "type")),
    };
  }
  if (node.type === "Column" || node.type === "Row") {
    return { ...node, children: Array.isArray(node.children) ? node.children.map(normalizeNode) : [] };
  }
  return node;
}

function normalizeSurface(surface: any, index: number): any {
  if (surface?.tree) return { ...surface, tree: normalizeNode(surface.tree) };
  if (surface?.type && WIDGET_NAMES.has(surface.type)) {
    return {
      id: `${String(surface.type).toLowerCase()}-${index + 1}`,
      w: surface.type === "Kpi" ? 4 : 6,
      h: surface.type === "Kpi" ? 2 : 3,
      tree: normalizeNode(surface),
    };
  }
  return surface;
}

const prompt = `
Emit ONLY a JSON array of 3 dashboard surfaces for repo "vercel/next.js".
Each item must match:

  {
    "id": string,
    "w": int (3..12),
    "h": int (1..6),
    "tree": { "type":"Component", "name":"Kpi"|"LineChart"|"Heatmap", "props": {...} }
  }

No prose. No code fences.
`.trim();

(async () => {
  const request = client.chat.completions.create({
    model: process.env.OLLAMA_MODEL ?? "qwen2.5:14b",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    max_tokens: 2048,
  });
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("Ollama request timed out after 90s")), 90_000);
  });
  const r = await Promise.race([request, timeout]);
  const raw = (r.choices[0].message.content ?? "").trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  const parsed = JSON.parse(raw);
  const arr = Array.isArray(parsed) ? parsed : [parsed];
  arr.map(normalizeSurface).forEach((x) => SurfaceSchema.parse(x));
  console.log(`✓ ${arr.length} surfaces passed schema check.`);
  process.exit(0);
})().catch((e) => {
  console.error("✗", e?.message ?? e);
  process.exit(1);
});
