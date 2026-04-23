/**
 * Shared types for the agent <-> UI state contract.
 *
 * The agent mirrors every A2UI surface it creates into this shape inside
 * useAgent().state. That lets the canvas render surfaces as grid cells
 * instead of a linear chat transcript. The A2UI spec still governs the
 * tree shape; we just keep a parallel registry for layout metadata.
 */

export type Theme = "dark" | "light" | "retro" | "terminal";
export type ShowcaseStage =
  | "intake"
  | "research"
  | "storyboard"
  | "script"
  | "rehearsal"
  | "approved";

export interface AgentSharedState {
  theme: Theme;
  title?: string;
  subject?: string; // e.g. "vercel/next.js"
  stage?: ShowcaseStage;
  brief?: ShowcaseBrief | null;
  scorecard?: ShowcaseScorecard | null;
  scriptBeats?: ScriptBeat[];
  pinnedInsights?: PinnedInsight[];
  surfaces: SurfaceMeta[];
  selection?: { surfaceId: string; nodeId?: string } | null;
  filters?: Record<string, unknown>;
}

export interface ShowcaseBrief {
  productName?: string;
  audience?: string;
  thesis?: string;
  demoGoal?: string;
  repo?: string;
}

export interface ShowcaseScorecard {
  clarity?: number;
  novelty?: number;
  technicalDepth?: number;
  utility?: number;
  demoReadiness?: number;
  risks?: string[];
}

export interface ScriptBeat {
  id: string;
  timebox: string;
  title: string;
  talkingPoint: string;
  artifact?: string;
}

export interface PinnedInsight {
  id: string;
  label: string;
  value: string;
  source?: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "accent";
}

export interface SurfaceMeta {
  id: string;
  title?: string;
  /** Grid column span, 3..12 */
  w: number;
  /** Grid row span, 1..6 */
  h: number;
  /** Root A2UI node */
  tree: A2UINode;
  /** Arbitrary data model the agent can mutate without re-rendering the tree */
  data?: Record<string, unknown>;
  /** Human-readable notes and review comments attached during demo prep */
  annotations?: SurfaceAnnotation[];
}

export interface SurfaceAnnotation {
  id: string;
  text: string;
  author?: "agent" | "user";
  createdAt?: string;
}

/**
 * Minimal A2UI-inspired node shape.
 *
 * This is NOT the full Google A2UI spec — it's a subset that covers the 8
 * widget types MorphBoard needs. The full spec (github.com/google/A2UI) is
 * richer (Column/Row/Card/Text/Image/Button/TextField/List with
 * dataModelUpdate). We use the full renderer from @copilotkit/a2ui-renderer
 * for chat messages, and this simplified tree for grid widgets.
 */
export type A2UINode =
  | { type: "Column"; gap?: number; children: A2UINode[] }
  | { type: "Row"; gap?: number; children: A2UINode[] }
  | { type: "Text"; text: string; variant?: "heading" | "subtitle" | "body" | "mono" }
  | { type: "Badge"; text: string; tone?: "neutral" | "success" | "warning" | "danger" | "accent" }
  | { type: "Button"; text: string; actionId: string; tone?: "primary" | "ghost" }
  | { type: "Divider" }
  | { type: "Component"; name: string; props: Record<string, unknown> };

export const DEFAULT_STATE: AgentSharedState = {
  theme: "dark",
  title: "MorphBoard Studio",
  subject: "",
  stage: "intake",
  brief: null,
  scorecard: null,
  scriptBeats: [],
  pinnedInsights: [],
  surfaces: [],
  selection: null,
};
