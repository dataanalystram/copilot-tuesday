"use client";

/**
 * Suggestions — "how can I help?" starter pills.
 *
 * VERIFIED against @copilotkit/react-core@1.56.2 .d.cts on Apr 19, 2026:
 *
 *   useConfigureSuggestions(config, deps?)
 *     config: DynamicSuggestionsConfig | StaticSuggestionsConfigInput | null
 *
 *   StaticSuggestionsConfigInput = {
 *     suggestions: { title: string; message: string; className?: string; isLoading?: boolean }[]
 *     available?: "before-first-message"|"after-first-message"|"always"|"disabled"
 *     consumerAgentId?: string
 *   }
 *
 *   useSuggestions({agentId?}) : {
 *     suggestions: Suggestion[],
 *     reloadSuggestions(): void,
 *     clearSuggestions(): void,
 *     isLoading: boolean,
 *   }
 *
 * Suggestion.message is what the agent actually receives as the user message
 * when a pill is clicked; Suggestion.title is the short pill label.
 *
 * We register TWO configs:
 *   1. Static "cold start" pills that always appear before the first message
 *      so the canvas never feels empty for a new user.
 *   2. Dynamic follow-up suggestions that the agent generates AFTER the first
 *      message — "want a deeper look at contributors?", etc.
 */

import { useCallback } from "react";
import { useAgent, useCopilotKit, useConfigureSuggestions, useSuggestions } from "@copilotkit/react-core/v2";
import { motion } from "framer-motion";
import { handleLocalDashboardCommand } from "@/lib/instant-dashboard";
import type { AgentSharedState } from "@/lib/agent-state";
import { maybeRequestCanvasApproval } from "@/lib/local-approval";

const STARTERS = [
  {
    title: "Analyze this app",
    message: "Inspect this project and explain the main frontend and backend architecture.",
  },
  {
    title: "GitHub dashboard",
    message: "Build a GitHub dashboard for vercel/next.js with stars, commit heatmap, contributors, and open issues.",
  },
  {
    title: "Data analyst",
    message: "When I upload a CSV, profile it with Python and build labeled charts with useful takeaways.",
  },
  {
    title: "Clean canvas",
    message: "Clear the current canvas and start a focused analysis workspace.",
  },
];

export default function Suggestions() {
  // Static cold-start suggestions. available:"before-first-message" hides
  // them once the conversation starts — we fall back to dynamic ones then.
  useConfigureSuggestions(
    {
      available: "before-first-message",
      suggestions: STARTERS,
    },
    [],
  );

  // Dynamic follow-ups. The agent generates 2–3 based on the current state.
  useConfigureSuggestions(
    {
      available: "after-first-message",
      instructions: `
Propose 2-3 SHORT follow-up actions tailored to the current work.
Prefer data analysis, repo inspection, chart improvements, file grounding, or
focused dashboard edits. Never repeat something the user just asked for. Each
suggestion must be a self-contained instruction.
      `.trim(),
      minSuggestions: 2,
      maxSuggestions: 3,
    },
    [],
  );

  return null;
}

/**
 * SuggestionPills — renders the current suggestions as interactive pills.
 *
 * Clicking a pill adds the suggestion's message to the agent and kicks off
 * a run. We reach into the agent via useAgent() rather than relying on
 * CopilotChat's internal handler because we want pills anywhere — in the
 * empty hero, in the toolbar, not just in the chat sidebar.
 */
export function SuggestionPills({
  className,
  max = 4,
}: {
  className?: string;
  max?: number;
}) {
  const { agent } = useAgent();
  const { copilotkit } = useCopilotKit();
  const { suggestions, isLoading } = useSuggestions({});

  const onPick = useCallback(
    (message: string) => {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      agent.addMessage({ id, role: "user", content: message });
      if (maybeRequestCanvasApproval(message, agent.state as AgentSharedState | undefined)) {
        return;
      }
      const local = handleLocalDashboardCommand(message, agent.state as AgentSharedState | undefined);
      if (local.shouldRunAgent) {
        void copilotkit.runAgent({ agent });
      }
    },
    [agent, copilotkit],
  );

  if (!suggestions.length && !isLoading) return null;

  return (
    <div className={`flex flex-wrap gap-2 ${className ?? ""}`}>
      {suggestions.slice(0, max).map((s, i) => (
        <motion.button
          key={`${s.title}-${i}`}
          type="button"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04, type: "spring", stiffness: 260, damping: 22 }}
          onClick={() => onPick(s.message)}
          disabled={s.isLoading}
          aria-label={`Run suggestion: ${s.title}`}
          className={`group pointer-events-auto rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 backdrop-blur-md transition hover:border-violet-400/60 hover:bg-violet-500/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:opacity-50 ${s.className ?? ""}`}
        >
          <span className="mr-1 text-violet-300/70 group-hover:text-violet-200">›</span>
          {s.title}
        </motion.button>
      ))}
    </div>
  );
}
