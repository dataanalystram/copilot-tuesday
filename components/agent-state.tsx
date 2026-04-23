"use client";

import { useEffect, useRef } from "react";
import { useAgent } from "@copilotkit/react-core/v2";
import { DEFAULT_STATE, type AgentSharedState, type SurfaceMeta } from "@/lib/agent-state";
import { surfacesStore } from "@/lib/surfaces-store";

export default function AgentState() {
  const { agent } = useAgent();
  const prevSurfacesRef = useRef<SurfaceMeta[] | null>(null);

  // Initialize agent state with DEFAULT_STATE on first mount.
  useEffect(() => {
    const current = agent.state as Partial<AgentSharedState> | undefined;
    const needsInit = !current ||
      !("theme" in current) ||
      !("surfaces" in current) ||
      !("title" in current) ||
      !("subject" in current) ||
      !("stage" in current) ||
      !("scriptBeats" in current) ||
      !("pinnedInsights" in current);

    if (needsInit) {
      agent.setState({
        ...DEFAULT_STATE,
        ...(current || {}),
      } as unknown as Record<string, unknown>);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync agent.state.surfaces → surfacesStore.
  // This handles the case where the model uses AGUISendStateDelta instead of
  // morph_surface to update the dashboard. Both paths end up in the Canvas.
  const agentSurfaces = (agent.state as AgentSharedState | undefined)?.surfaces;
  useEffect(() => {
    if (!Array.isArray(agentSurfaces)) return;
    if (agentSurfaces === prevSurfacesRef.current) return;
    prevSurfacesRef.current = agentSurfaces;
    if (agentSurfaces.length > 0) {
      surfacesStore.set(agentSurfaces);
    }
  }, [agentSurfaces]);

  return null;
}
