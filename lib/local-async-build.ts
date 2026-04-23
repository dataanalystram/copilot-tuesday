"use client";

import { githubToSurfaces } from "./github-surfaces";
import { researchToSurfaces } from "./research-surfaces";
import { surfacesStore } from "./surfaces-store";

export async function runLocalAsyncBuild(kind: "github" | "research", topic?: string) {
  if (kind === "github") {
    const response = await fetch("/api/github/dashboard", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ repo: topic || "vercel/next.js" }),
    });
    if (!response.ok) throw new Error(await response.text());
    const payload = await response.json();
    surfacesStore.set(githubToSurfaces(payload));
    return;
  }

  const response = await fetch("/api/research/topic", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: topic || "global EV market trends" }),
  });
  if (!response.ok) throw new Error(await response.text());
  const payload = await response.json();
  surfacesStore.set(researchToSurfaces(payload));
}
