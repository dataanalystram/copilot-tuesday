/**
 * Probe: local Ollama OpenAI-compatible round-trip + widget JSON validity.
 */

import { config } from "dotenv";
import OpenAI from "openai";

config({ path: ".env.local" });
config();

const baseURL = `${(process.env.OLLAMA_BASE_URL ?? "http://localhost:11434").replace(/\/$/, "")}/v1`;
const model = process.env.OLLAMA_MODEL ?? "qwen2.5:14b";

const client = new OpenAI({
  apiKey: process.env.OLLAMA_API_KEY ?? "ollama",
  baseURL,
  timeout: 90_000,
});

const prompt = `
You are a widget generator. Respond with ONLY a JSON object matching this shape:

  { "type": "Kpi", "props": { "label": string, "value": string|number, "delta"?: string, "trend"?: "up"|"down"|"flat" } }

Generate a KPI widget representing: "GitHub stars for vercel/next.js, approximately 130k, trending up by 2.1% this week".
No prose. No code fences. JSON only.
`.trim();

async function main() {
  console.log("→ Probing local Ollama...");
  console.log("  model:   ", model);
  console.log("  baseURL: ", baseURL);

  const t0 = Date.now();
  const r = await client.chat.completions.create({
    model,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    max_tokens: 512,
  });
  const ms = Date.now() - t0;

  const content = r.choices?.[0]?.message?.content ?? "";
  console.log(`\n✓ Response in ${ms}ms`);
  console.log("  raw:", content);

  const stripped = content.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    console.error("\n✗ JSON parse failed. The model returned prose or malformed JSON.");
    process.exit(2);
  }

  const ok =
    !!parsed &&
    typeof parsed === "object" &&
    (parsed as Record<string, unknown>).type === "Kpi" &&
    !!(parsed as Record<string, unknown>).props;

  if (!ok) {
    console.error("\n✗ JSON parsed but did not match the Kpi widget schema:", parsed);
    process.exit(3);
  }

  console.log("\n✓ Ollama + widget JSON output look healthy.");
}

main().catch((e) => {
  console.error("\n✗ Probe failed:", e?.message ?? e);
  process.exit(1);
});
