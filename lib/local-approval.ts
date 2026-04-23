"use client";

import { useEffect, useState } from "react";
import type { AgentSharedState } from "./agent-state";
import { surfacesStore } from "./surfaces-store";

interface PendingApproval {
  id: string;
  title: string;
  summary: string;
  approveLabel: string;
  rejectLabel: string;
  apply: () => void;
}

let pending: PendingApproval | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export const localApprovalStore = {
  get: () => pending,
  set: (next: PendingApproval | null) => {
    pending = next;
    emit();
  },
  approve: () => {
    const current = pending;
    if (!current) return;
    current.apply();
    pending = null;
    emit();
  },
  reject: () => {
    pending = null;
    emit();
  },
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useLocalApproval() {
  const [value, setValue] = useState(localApprovalStore.get());
  useEffect(() => {
    setValue(localApprovalStore.get());
    return localApprovalStore.subscribe(() => setValue(localApprovalStore.get()));
  }, []);
  return value;
}

export function maybeRequestCanvasApproval(message: string, state?: AgentSharedState | null) {
  const lower = message.toLowerCase();
  const selectedId = state?.selection?.surfaceId ?? null;

  if (/\b(clear|reset|wipe)\b/.test(lower) && /\b(canvas|dashboard|board|widgets?)\b/.test(lower)) {
    localApprovalStore.set({
      id: `approval_${Date.now()}`,
      title: "Clear canvas?",
      summary: "This will remove every widget from the current dashboard canvas.",
      approveLabel: "Clear",
      rejectLabel: "Keep",
      apply: () => surfacesStore.set([]),
    });
    return true;
  }

  if (selectedId && /\b(remove|delete|hide)\b/.test(lower) && /\b(selected|this|widget|card)\b/.test(lower)) {
    localApprovalStore.set({
      id: `approval_${Date.now()}`,
      title: "Remove selected widget?",
      summary: `This will remove "${selectedId}" from the canvas.`,
      approveLabel: "Remove",
      rejectLabel: "Cancel",
      apply: () => surfacesStore.set(surfacesStore.get().filter((surface) => surface.id !== selectedId)),
    });
    return true;
  }

  return false;
}
