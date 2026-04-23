"use client";

/**
 * Agent context — what the agent knows *about the app* beyond tool results.
 *
 * VERIFIED against @copilotkit/react-core@1.56.2 .d.cts on Apr 19, 2026:
 *
 *   interface AgentContextInput {
 *     description: string;                 // human-readable label
 *     value: JsonSerializable;             // serialized to JSON
 *   }
 *   declare function useAgentContext(context: AgentContextInput): void;
 *
 *   useLayoutEffect under the hood — the context string is re-registered on
 *   every render whose description/value changes, so we can safely derive
 *   values from shared state.
 *
 * We inject three pieces of dynamic context so the agent never has to ask:
 *   - current_repo         (default, or whatever the user last typed)
 *   - current_time_iso     (so it can talk about "today" sensibly)
 *   - current_selection    (if the user has selected a surface)
 *   - current_theme
 *   - current_surfaces     (names + types only — keeps the prompt tight)
 */

import { useMemo } from "react";
import { useAgent, useAgentContext } from "@copilotkit/react-core/v2";
import type { AgentSharedState } from "@/lib/agent-state";
import { useSurfaces } from "@/lib/surfaces-store";

const DEFAULT_REPO = process.env.NEXT_PUBLIC_DEFAULT_REPO ?? "vercel/next.js";

export default function AgentContext() {
  const { agent } = useAgent();
  const state = (agent.state as AgentSharedState | undefined) ?? undefined;
  // Surfaces live in the synchronous client store, not useAgent state.
  const surfaces = useSurfaces();

  const repo = state?.subject ?? DEFAULT_REPO;
  const theme = state?.theme ?? "dark";
  const selection = state?.selection?.surfaceId ?? null;

  // Keep this JSON compact — it gets stringified into the system prompt.
  const surfaceSummary = useMemo(
    () =>
      surfaces.map((s, index) => {
        const t = s.tree as { type?: string; name?: string } | undefined;
        const kind =
          t && t.type === "Component" && typeof t.name === "string"
            ? t.name
            : (t?.type ?? "unknown");
        return {
          index,         // position in the grid (left-to-right, top-to-bottom)
          id: s.id,
          title: s.title ?? null,
          kind,
          w: s.w,        // grid columns (3–12)
          h: s.h,        // grid rows (1–6)
        };
      }),
    [surfaces],
  );

  useAgentContext({
    description: "current_repo",
    value: repo,
  });
  useAgentContext({
    description: "current_time_iso",
    value: new Date().toISOString(),
  });
  useAgentContext({
    description: "current_theme",
    value: theme,
  });
  useAgentContext({
    description: "current_selection",
    value: selection,
  });
  useAgentContext({
    description: "current_surfaces",
    value: surfaceSummary,
  });

  return null;
}
