"use client";

/**
 * Frontend tools + human-in-the-loop hooks.
 *
 * Every hook shape below was verified against the installed
 * @copilotkit/react-core@1.56.2 .d.cts types on Apr 19, 2026:
 *
 *   useFrontendTool({name, description, parameters, handler}):
 *     Client-side tool the agent can call. `parameters` is Standard Schema
 *     V1 (Zod 3+/4, Valibot, ArkType).
 *
 *   useInterrupt({render, handler?, enabled?, renderInChat?}):
 *     NO `name` or `description`. Fires when the running agent raises an
 *     interrupt event. `render` receives {resolve, result, event}.
 *
 *   useHumanInTheLoop(tool):
 *     tool = Omit<FrontendTool, "handler"> & { render }.
 *     render receives {name, description, args, status, result, respond}.
 *     respond(result) resumes the agent with the user's decision.
 */

import { useAgent, useFrontendTool, useInterrupt } from "@copilotkit/react-core/v2";
import { z } from "zod";
import type {
  AgentSharedState,
  SurfaceMeta,
  A2UINode,
  PinnedInsight,
  ScriptBeat,
  ShowcaseBrief,
  ShowcaseScorecard,
  ShowcaseStage,
} from "@/lib/agent-state";
import { surfacesStore } from "@/lib/surfaces-store";
import { requestLocalApproval } from "@/lib/local-approval";

const NodeSchema: z.ZodType<A2UINode> = z.lazy(() =>
  z.union([
    z.object({ type: z.literal("Column"), gap: z.number().optional(), children: z.array(NodeSchema) }),
    z.object({ type: z.literal("Row"), gap: z.number().optional(), children: z.array(NodeSchema) }),
    z.object({
      type: z.literal("Text"),
      text: z.string(),
      variant: z.enum(["heading", "subtitle", "body", "mono"]).optional(),
    }),
    z.object({
      type: z.literal("Badge"),
      text: z.string(),
      tone: z.enum(["neutral", "success", "warning", "danger", "accent"]).optional(),
    }),
    z.object({
      type: z.literal("Button"),
      text: z.string(),
      actionId: z.string(),
      tone: z.enum(["primary", "ghost"]).optional(),
    }),
    z.object({ type: z.literal("Divider") }),
    z.object({
      type: z.literal("Component"),
      name: z.string(),
      props: z.record(z.string(), z.unknown()),
    }),
  ]),
);

const SurfaceSchema = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  w: z.number().int().min(3).max(12),
  h: z.number().int().min(1).max(6),
  tree: NodeSchema,
  data: z.record(z.string(), z.unknown()).optional(),
  annotations: z
    .array(
      z.object({
        id: z.string(),
        text: z.string(),
        author: z.enum(["agent", "user"]).optional(),
        createdAt: z.string().optional(),
      }),
    )
    .optional(),
});

const BriefSchema = z.object({
  productName: z.string().optional(),
  audience: z.string().optional(),
  thesis: z.string().optional(),
  demoGoal: z.string().optional(),
  repo: z.string().optional(),
});

const ScorecardSchema = z.object({
  clarity: z.number().min(0).max(100).optional(),
  novelty: z.number().min(0).max(100).optional(),
  technicalDepth: z.number().min(0).max(100).optional(),
  utility: z.number().min(0).max(100).optional(),
  demoReadiness: z.number().min(0).max(100).optional(),
  risks: z.array(z.string()).optional(),
});

const ScriptBeatSchema = z.object({
  id: z.string().min(1),
  timebox: z.string(),
  title: z.string(),
  talkingPoint: z.string(),
  artifact: z.string().optional(),
});

const InsightSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  value: z.string(),
  source: z.string().optional(),
  tone: z.enum(["neutral", "success", "warning", "danger", "accent"]).optional(),
});

function mergeAgentState(
  agent: ReturnType<typeof useAgent>["agent"],
  patch: Partial<AgentSharedState>,
) {
  const current = (agent.state as AgentSharedState | undefined) ?? ({} as AgentSharedState);
  agent.setState({
    ...current,
    ...patch,
  } as unknown as Record<string, unknown>);
}

export default function FrontendTools() {
  const { agent } = useAgent();

  useFrontendTool({
    name: "morph_surface",
    description:
      "Add, update, or remove an analysis artifact card on the Studio canvas. Use add for new cards, update to revise in place, remove to delete.",
    parameters: z.object({
      action: z.enum(["add", "update", "remove"]),
      surface: SurfaceSchema.partial().optional().describe("Full SurfaceMeta for add (id/w/h/tree required). Partial fields for update."),
      id: z.string().optional().describe("Required for remove/update by id."),
    }),
    handler: async ({ action, surface, id }) => {
      // 100% frontend synchronous updates — totally immune to network race conditions
      const cur = surfacesStore.get();
      
      let nextSurfaces = cur;
      let ok = false;
      const retId = id || surface?.id;

      if (action === "add" && surface) {
        nextSurfaces = [...cur.filter((x) => x.id !== surface.id), surface as SurfaceMeta];
        ok = true;
      } else if (action === "update" && retId) {
        nextSurfaces = cur.map((x) =>
          x.id === retId ? ({ ...x, ...(surface ?? {}) } as SurfaceMeta) : x,
        );
        ok = true;
      } else if (action === "remove" && retId) {
        nextSurfaces = cur.filter((x) => x.id !== retId);
        ok = true;
      }

      if (ok) {
        surfacesStore.set(nextSurfaces);
        return { ok: true, id: retId };
      }
      return { ok: false, error: "bad args" };
    },
  });

  useFrontendTool({
    name: "set_theme",
    description: "Change the dashboard theme. Purely visual; does not re-render widgets.",
    parameters: z.object({ theme: z.enum(["dark", "light", "retro", "terminal"]) }),
    handler: async ({ theme }) => {
      mergeAgentState(agent, { theme });
      return { ok: true, theme };
    },
  });

  useFrontendTool({
    name: "set_showcase_stage",
    description:
      "Update the visible workspace stage and optional brief/scorecard state.",
    parameters: z.object({
      stage: z.enum(["intake", "research", "storyboard", "script", "rehearsal", "approved"]),
      brief: BriefSchema.optional(),
      scorecard: ScorecardSchema.optional(),
    }),
    handler: async ({ stage, brief, scorecard }) => {
      mergeAgentState(agent, {
        stage: stage as ShowcaseStage,
        ...(brief ? { brief: brief as ShowcaseBrief } : {}),
        ...(scorecard ? { scorecard: scorecard as ShowcaseScorecard } : {}),
      });
      return { ok: true, stage };
    },
  });

  useFrontendTool({
    name: "pin_insight",
    description:
      "Pin a high-value insight to the Studio state so it can be reused in scorecards, summaries, and artifacts.",
    parameters: z.object({
      insight: InsightSchema,
    }),
    handler: async ({ insight }) => {
      const state = (agent.state as AgentSharedState | undefined) ?? ({} as AgentSharedState);
      const current = state.pinnedInsights ?? [];
      const next = [
        ...current.filter((item) => item.id !== insight.id),
        insight as PinnedInsight,
      ];
      mergeAgentState(agent, { pinnedInsights: next });
      return { ok: true, id: insight.id };
    },
  });

  useFrontendTool({
    name: "update_script_beat",
    description:
      "Add, update, or remove one timeboxed beat in a walkthrough or delivery script.",
    parameters: z.object({
      action: z.enum(["add", "update", "remove"]),
      beat: ScriptBeatSchema.partial().optional(),
      id: z.string().optional(),
    }),
    handler: async ({ action, beat, id }) => {
      const state = (agent.state as AgentSharedState | undefined) ?? ({} as AgentSharedState);
      const current = state.scriptBeats ?? [];
      const targetId = id ?? beat?.id;
      let next = current;

      if (action === "add" && beat?.id) {
        next = [
          ...current.filter((item) => item.id !== beat.id),
          beat as ScriptBeat,
        ];
      } else if (action === "update" && targetId) {
        next = current.map((item) =>
          item.id === targetId ? ({ ...item, ...beat, id: targetId } as ScriptBeat) : item,
        );
      } else if (action === "remove" && targetId) {
        next = current.filter((item) => item.id !== targetId);
      } else {
        return { ok: false, error: "bad args" };
      }

      mergeAgentState(agent, { scriptBeats: next });
      return { ok: true, id: targetId };
    },
  });

  useFrontendTool({
    name: "annotate_surface",
    description:
      "Attach a concise review note to a specific Studio artifact card.",
    parameters: z.object({
      surfaceId: z.string(),
      annotation: z.string(),
      author: z.enum(["agent", "user"]).default("agent"),
    }),
    handler: async ({ surfaceId, annotation, author }) => {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const next = surfacesStore.get().map((surface) =>
        surface.id === surfaceId
          ? {
              ...surface,
              annotations: [
                ...(surface.annotations ?? []),
                { id, text: annotation, author, createdAt: new Date().toISOString() },
              ],
            }
          : surface,
      );
      surfacesStore.set(next);
      return { ok: true, id, surfaceId };
    },
  });

  useFrontendTool({
    name: "approve_morph",
    description:
      "Ask the user to approve a batch of morph_surface operations before applying them. Use for destructive morphs (clearing dashboard, removing >3 widgets).",
    parameters: z.object({
      reason: z.string().describe("Why this approval is needed."),
      summary: z.string().describe("Short, human-readable summary of the pending change."),
    }),
    handler: async ({ reason, summary }) => {
      return requestLocalApproval({
        title: "Approve change?",
        summary: `${reason}\n\n${summary}`,
        approveLabel: "Approve",
        rejectLabel: "Reject",
      });
    },
  });

  useFrontendTool({
    name: "approve_showcase_plan",
    description:
      "Ask the user to approve the final analysis plan before marking it ready.",
    parameters: z.object({
      title: z.string().describe("Short name for the final plan."),
      scriptSummary: z.string().describe("The plan or walkthrough summarized as timeboxed beats."),
      risks: z.array(z.string()).default([]).describe("Known risks and fallback moves."),
    }),
    handler: async ({ title, scriptSummary, risks }) => {
      const result = await requestLocalApproval({
        title: `Approve plan: ${title}`,
        summary: `${scriptSummary}${risks.length ? `\n\nRisks:\n- ${risks.join("\n- ")}` : ""}`,
        approveLabel: "Approve",
        rejectLabel: "Revise",
        apply: () => mergeAgentState(agent, { stage: "approved" }),
      });
      return result;
    },
  });

  /* --------------------------------------------------------------------
   * Interrupt: generic pause-and-resolve. Useful if the backend agent
   * raises an interrupt (e.g. LangGraph-style) mid-run. No name/description;
   * fires by event rather than by tool call.
   * -------------------------------------------------------------------- */

  useInterrupt({
    render: ({ resolve, result }) => (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
        <div className="font-medium text-amber-200 mb-1">Agent paused</div>
        <div className="text-amber-100/80 mb-2">
          {typeof result === "string" ? result : "The agent is waiting for input."}
        </div>
        <div className="flex gap-2">
          <button
            className="rounded bg-amber-400 text-amber-950 px-2 py-1 text-xs font-medium"
            onClick={() => resolve({ confirmed: true })}
          >
            Continue
          </button>
          <button
            className="rounded bg-white/10 text-white/80 px-2 py-1 text-xs"
            onClick={() => resolve({ confirmed: false })}
          >
            Cancel
          </button>
        </div>
      </div>
    ),
  });

  return null;
}
