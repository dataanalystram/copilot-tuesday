"use client";

import type { SurfaceMeta } from "./agent-state";
import { surfacesStore } from "./surfaces-store";

const history: SurfaceMeta[][] = [];
const MAX_HISTORY = 20;

export function snapshotSurfaces() {
  history.push(structuredClone(surfacesStore.get()));
  if (history.length > MAX_HISTORY) history.shift();
}

export function undoSurfaceChange() {
  const previous = history.pop();
  if (!previous) return false;
  surfacesStore.set(previous);
  return true;
}
