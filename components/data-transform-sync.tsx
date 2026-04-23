"use client";

import { useEffect, useRef } from "react";

import { dataTransformToSurfaces } from "@/lib/data-transform-surfaces";
import type { DataTransformResult } from "@/lib/research-cache";
import { snapshotSurfaces } from "@/lib/surface-history";
import { surfacesStore } from "@/lib/surfaces-store";

export default function DataTransformSync() {
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

    const stageSurfaces = (result: DataTransformResult) => {
      clearSequence();
      snapshotSurfaces();
      const staged = dataTransformToSurfaces(result);
      surfacesStore.set([
        {
          id: "data-transforming",
          title: "Python analyst",
          w: 12,
          h: 2,
          tree: {
            type: "Component",
            name: "Markdown",
            props: {
              title: "Python analyst is updating the canvas",
              content: `Cleaning and transforming **${result.filename}** for: ${result.task}`,
            },
          },
        },
      ]);

      staged.forEach((surface, index) => {
        const timer = window.setTimeout(() => {
          if (cancelled) return;
          const next = surfacesStore
            .get()
            .filter((item) => item.id !== "data-transforming" && item.id !== surface.id);
          surfacesStore.set([...next, surface]);
        }, 180 + index * 360);
        timers.push(timer);
      });
    };

    const poll = async () => {
      try {
        const response = await fetch("/api/data/latest", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as {
          id?: number;
          result?: DataTransformResult | null;
        };
        if (!payload.result || !payload.id || payload.id <= latestId.current) return;
        latestId.current = payload.id;
        stageSurfaces(payload.result);
      } catch {
        // Best-effort. The direct API/tool response still exists if polling misses.
      }
    };

    void poll();
    const timer = window.setInterval(() => {
      if (!cancelled) void poll();
    }, 750);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      clearSequence();
    };
  }, []);

  return null;
}
