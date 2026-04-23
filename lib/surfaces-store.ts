import { useState, useEffect } from 'react';
import type { SurfaceMeta } from './agent-state';

let currentSurfaces: SurfaceMeta[] = [];
const listeners: Set<() => void> = new Set();

/**
 * A lightweight, synchronous, frontend-only store for dashboard surfaces.
 * 
 * Bypassing useAgent().state for surfaces eliminates network race conditions
 * where rapidly dispatched parallel tool calls from the LLM get out of sync
 * with the CopilotKit backend Server-Sent-Events stream.
 */
export const surfacesStore = {
  get: () => currentSurfaces,
  set: (next: SurfaceMeta[]) => {
    currentSurfaces = next;
    listeners.forEach((l) => l());
  },
  subscribe: (l: () => void): (() => void) => {
    listeners.add(l);
    // Return a void-returning unsubscribe (Set.delete returns a boolean,
    // which would trip the React Destructor type).
    return () => {
      listeners.delete(l);
    };
  },
};

export function useSurfaces() {
  const [surfaces, setSurfaces] = useState(surfacesStore.get());

  useEffect(() => {
    // Initial sync in case it changed between render and effect
    setSurfaces(surfacesStore.get());
    const unsubscribe = surfacesStore.subscribe(() => {
      setSurfaces(surfacesStore.get());
    });
    return unsubscribe;
  }, []);

  return surfaces;
}
