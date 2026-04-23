"use client";

/**
 * Tool-call chips — live "fetching github_repo…" badges in chat.
 *
 * VERIFIED against @copilotkit/react-core@1.56.2 .d.cts on Apr 19, 2026:
 *
 *   useRenderTool({
 *     name: "*",
 *     render: (props: any) => React.ReactElement,
 *     agentId?: string,
 *   }, deps?)
 *
 *   useRenderTool<S extends StandardSchemaV1>({
 *     name: string,
 *     parameters: S,
 *     render: (props: RenderToolProps<S>) => React.ReactElement,
 *     agentId?: string,
 *   }, deps?)
 *
 *   DefaultRenderProps (wildcard) = {
 *     name: string;
 *     parameters: unknown;
 *     status: "inProgress" | "executing" | "complete";
 *     result: string | undefined;
 *   }
 *
 * One wildcard renderer is enough to give every tool a uniform chip. We
 * keep the UI <=1 line so streaming tool-chains don't blow up the transcript.
 */

import { useRenderTool } from "@copilotkit/react-core/v2";
import { motion } from "framer-motion";

// Map known tool names to friendlier labels. Unknown tools fall back to
// the raw name so we never "lose" a chip to a bad lookup.
const LABELS: Record<string, string> = {
  github_repo: "Fetching repo stats",
  github_contributors: "Loading contributors",
  github_issues: "Reading issues",
  github_commit_heatmap: "Building commit heatmap",
  github_star_trend: "Charting star trend",
  web_research_topic: "Researching topic",
  web_fetch_url: "Reading web source",
  python_data_profile: "Profiling data",
  python_data_transform: "Running Python analyst",
  project_file_tree: "Scanning project",
  project_file_read: "Reading file",
  morph_surface: "Morphing dashboard",
  set_theme: "Updating theme",
  approve_morph: "Asking approval",
};

function statusDot(status: string): string {
  switch (status) {
    case "complete":
      return "bg-emerald-400";
    case "executing":
      return "bg-violet-400 animate-pulse";
    case "inProgress":
    default:
      return "bg-amber-400 animate-pulse";
  }
}

function statusGlyph(status: string): string {
  switch (status) {
    case "complete":
      return "✓";
    case "executing":
      return "…";
    case "inProgress":
    default:
      return "◌";
  }
}

export default function ToolCallChips() {
  useRenderTool(
    {
      name: "*",
      render: (props) => {
        // `props` is unknown for the wildcard renderer; coerce to the
        // documented DefaultRenderProps shape.
        const { name, status, parameters } = props as {
          name: string;
          parameters: unknown;
          status: "inProgress" | "executing" | "complete";
          result: string | undefined;
        };
        const label = LABELS[name] ?? name;
        // Surface a tiny hint of the first scalar arg so the chip reads
        // nicely: "Loading contributors · vercel/next.js"
        let hint = "";
        if (parameters && typeof parameters === "object") {
          const first = Object.values(parameters as Record<string, unknown>).find(
            (v) => typeof v === "string" || typeof v === "number",
          );
          if (typeof first === "string" || typeof first === "number") {
            hint = String(first);
            if (hint.length > 32) hint = hint.slice(0, 30) + "…";
          }
        }
        return (
          <motion.div
            layout
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 24 }}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-mono text-white/80"
            role="status"
            aria-live="polite"
            aria-label={`${label}${hint ? `: ${hint}` : ""}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${statusDot(status)}`} aria-hidden />
            <span>{statusGlyph(status)}</span>
            <span className="text-white/90">{label}</span>
            {hint && <span className="text-white/40">·</span>}
            {hint && <span className="text-white/60">{hint}</span>}
          </motion.div>
        );
      },
    },
    [],
  );

  return null;
}
