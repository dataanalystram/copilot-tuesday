/**
 * Studio LLM config.
 *
 * The Studio agent uses Ollama through its OpenAI-compatible `/v1` endpoint so
 * local Qwen can drive CopilotKit without paid hosted inference.
 */

function normalizeOllamaBaseUrl(value: string | undefined): string {
  const raw = value?.trim() || "http://localhost:11434";
  return raw.endsWith("/v1") ? raw : `${raw.replace(/\/$/, "")}/v1`;
}

export const LLM_CONFIG = {
  provider: "ollama",
  model: process.env.OLLAMA_MODEL ?? "qwen2.5:14b",
  apiKey: process.env.OLLAMA_API_KEY ?? "ollama",
  baseUrl: normalizeOllamaBaseUrl(process.env.OLLAMA_BASE_URL),
} as const;

export function assertLlmConfig(): void {
  if (!LLM_CONFIG.model) {
    throw new Error("OLLAMA_MODEL is missing. Set it to qwen2.5:14b or another local Ollama model.");
  }
}
