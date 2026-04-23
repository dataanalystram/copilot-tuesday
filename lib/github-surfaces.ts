"use client";

import type { SurfaceMeta } from "./agent-state";

interface RepoStats {
  full_name: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  subscribers_count?: number;
  pushed_at: string;
}

interface Contributor {
  login: string;
  contributions: number;
}

interface Issue {
  number: number;
  title: string;
  state: "open" | "closed";
  author: string;
  ageDays: number;
}

interface StarPoint {
  x: string;
  y: number;
}

function component(name: string, props: Record<string, unknown>): SurfaceMeta["tree"] {
  return { type: "Component", name, props };
}

export function githubToSurfaces({
  repo,
  contributors,
  commitGrid,
  issues,
  stars,
}: {
  repo: RepoStats;
  contributors: Contributor[];
  commitGrid: number[][];
  issues: Issue[];
  stars: StarPoint[];
}): SurfaceMeta[] {
  const pushed = repo.pushed_at ? new Date(repo.pushed_at).toLocaleDateString() : "unknown";
  return [
    {
      id: "repo-stars",
      title: "Stars",
      w: 4,
      h: 2,
      tree: component("Kpi", {
        label: "Stars",
        value: repo.stargazers_count.toLocaleString(),
        delta: `${repo.forks_count.toLocaleString()} forks`,
        trend: "up",
        hint: repo.full_name,
      }),
    },
    {
      id: "repo-issues",
      title: "Open issues",
      w: 4,
      h: 2,
      tree: component("Kpi", {
        label: "Open issues",
        value: repo.open_issues_count.toLocaleString(),
        delta: `pushed ${pushed}`,
        trend: repo.open_issues_count > 1000 ? "down" : "flat",
        hint: "GitHub",
      }),
    },
    {
      id: "repo-watchers",
      title: "Watchers",
      w: 4,
      h: 2,
      tree: component("Kpi", {
        label: "Watchers",
        value: repo.stargazers_count.toLocaleString(),
        delta: `${(repo.subscribers_count ?? 0).toLocaleString()} subscribers`,
        trend: "up",
        hint: "community signal",
      }),
    },
    {
      id: "repo-star-trend",
      title: "Star trend",
      w: 6,
      h: 3,
      tree: component("LineChart", {
        title: "Approximate star trend",
        data: stars,
        xLabel: "Month",
        yLabel: "Stars",
      }),
    },
    {
      id: "repo-contributors",
      title: "Contributors",
      w: 6,
      h: 3,
      tree: component("BarChart", {
        title: "Top contributors",
        data: contributors.slice(0, 8).map((item) => ({
          label: item.login,
          value: item.contributions,
        })),
        xLabel: "Contributor",
        yLabel: "Commits",
      }),
    },
    {
      id: "repo-commit-heatmap",
      title: "Commit heatmap",
      w: 6,
      h: 3,
      tree: component("Heatmap", {
        title: "Recent commit activity",
        grid: commitGrid,
      }),
    },
    {
      id: "repo-open-issues",
      title: "Recent issues",
      w: 6,
      h: 3,
      tree: component("Issues", {
        title: "Recent open issues",
        items: issues,
      }),
    },
    {
      id: "repo-summary",
      title: "Repository summary",
      w: 12,
      h: 2,
      tree: component("Markdown", {
        title: repo.full_name,
        content: `${repo.description ?? "Repository analysis"}\n\nBuilt directly from GitHub API data. Star history is approximate because GitHub REST does not expose full historical star events efficiently.`,
      }),
    },
  ];
}
