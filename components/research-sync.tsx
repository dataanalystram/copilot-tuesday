"use client";

import { useEffect, useRef } from "react";
import { researchToSurfaces } from "@/lib/research-surfaces";
import { surfacesStore } from "@/lib/surfaces-store";
import type { ResearchResult } from "@/lib/research-cache";

export default function ResearchSync() {
  const latestId = useRef(0);
  const sequenceRef = useRef<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    const timers = sequenceRef.current;

    const clearSequence = () => {
      while (timers.length) {
        const timer = timers.pop();
        if (timer) window.clearTimeout(timer);
      }
    };

    const stageSurfaces = (research: ResearchResult) => {
      clearSequence();
      const staged = researchToSurfaces(research);
      const current = surfacesStore.get();
      const progress = current.find((surface) => surface.id === "researching");
      surfacesStore.set(
        progress
          ? [
              {
                ...progress,
                tree: {
                  type: "Component",
                  name: "Markdown",
                  props: {
                    title: "Research complete",
                    content: `Found ${research.sources.length} sources for **${research.query}**. Building the dashboard one card at a time.`,
                  },
                },
              },
            ]
          : [],
      );

      staged.forEach((surface, index) => {
        const timer = window.setTimeout(() => {
          if (cancelled) return;
          const next = surfacesStore.get().filter((item) => item.id !== "researching" && item.id !== surface.id);
          surfacesStore.set([...next, surface]);
        }, 280 + index * 420);
        timers.push(timer);
      });
    };

    const poll = async () => {
      try {
        const response = await fetch("/api/research/latest", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as {
          id?: number;
          result?: ResearchResult | null;
        };
        if (!payload.result || !payload.id || payload.id <= latestId.current) return;
        latestId.current = payload.id;
        stageSurfaces(payload.result);
      } catch {
        // Polling is best-effort; CopilotKit tool output still appears in chat.
      }
    };

    void poll();
    const timer = window.setInterval(() => {
      if (!cancelled) void poll();
    }, 900);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      clearSequence();
    };
  }, []);

  return null;
}
