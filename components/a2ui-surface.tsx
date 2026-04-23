"use client";

/**
 * Mounts a single A2UI surface by id.
 *
 * The provider's A2UI renderer already rendered every surface the agent has
 * declared somewhere in the chat-message stream. But for a *dashboard*, we
 * want to pull specific surfaces out of that stream and place them in a
 * grid cell. The A2UI runtime exposes a query helper for this on the
 * renderer's context; if the exact hook name differs in your installed
 * version, swap the import.
 *
 * UNVERIFIED API: `useA2UISurface(surfaceId)` — plausible based on the
 * `@copilotkit/a2ui-renderer` 1.56 export pattern, but I could not read
 * the exact hook name from the live docs (docs.copilotkit.ai is an SPA).
 * If `useA2UISurface` does not exist, two fallbacks:
 *   1. Import the lower-level primitives: the renderer factory returns both
 *      `Renderer` (for chat) and `Surface` components on 1.5x; the latter
 *      takes a `surfaceId` prop.
 *   2. Roll our own: subscribe to `useAgent().state.surfaces[id].tree` and
 *      render via a tiny component dispatcher.
 *
 * The working assumption below is (2) — a self-rendered surface that pulls
 * the A2UI tree from our own shared state. The system prompt instructs the
 * agent to keep `state.surfaces[id].tree` in sync. This decouples us from
 * unverified A2UI internals and lets the demo run regardless.
 */

import { type A2UINode } from "@/lib/agent-state";
import { renderA2UINode } from "@/lib/a2ui-render";
import { useSurfaces } from "@/lib/surfaces-store";

export default function A2UISurface({ surfaceId }: { surfaceId: string }) {
  const surfaces = useSurfaces();
  const surface = surfaces.find((s) => s.id === surfaceId);
  if (!surface) return null;
  return <div className="h-full w-full p-4">{renderA2UINode(surface.tree)}</div>;
}

// Type-only re-export so consumers can import from this module
export type { A2UINode };
