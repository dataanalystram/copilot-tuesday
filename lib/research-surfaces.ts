import type { SurfaceMeta } from "./agent-state";
import type { ResearchResult } from "./research-cache";

function component(name: string, props: Record<string, unknown>): SurfaceMeta["tree"] {
  return { type: "Component", name, props };
}

export function researchToSurfaces(research: ResearchResult): SurfaceMeta[] {
  const metrics = research.metrics.slice(0, 3);
  const metricSurfaces = metrics.map((metric, index) => ({
    id: `research-metric-${index + 1}`,
    title: metric.label,
    w: 4,
    h: 2,
    tree: component("Kpi", {
      label: metric.label,
      value: `${metric.value}${metric.unit ?? ""}`,
      delta: metric.note ?? "Grounded",
      trend: "up",
      hint: research.query,
    }),
  } satisfies SurfaceMeta));

  return [
    ...metricSurfaces,
    {
      id: "research-category-bar",
      title: "Topic signals",
      w: 6,
      h: 3,
      tree: component("BarChart", {
        title: "Signal strength",
        data: research.categories,
        xLabel: "Signal",
        yLabel: "Index",
        unit: "",
      }),
    },
    {
      id: "research-category-share",
      title: "Signal mix",
      w: 6,
      h: 3,
      tree: component("PieChart", {
        title: "Signal mix",
        data: research.categories,
        unit: "",
      }),
    },
    {
      id: "research-timeline",
      title: "Evidence timeline",
      w: 6,
      h: 4,
      tree: component("Timeline", {
        title: "Source timeline",
        items: research.timeline.map((item, index) => ({
          label: item.label,
          date: item.date,
          value: item.value,
          tone: index === research.timeline.length - 1 ? "accent" : "neutral",
        })),
      }),
    },
    {
      id: "research-sources",
      title: "Sources",
      w: 6,
      h: 4,
      tree: component("DataTable", {
        title: "Grounding sources",
        columns: ["Title", "Source", "Snippet"],
        rows: research.sources.slice(0, 8).map((source) => ({
          Title: source.title,
          Source: source.url.replace(/^https?:\/\//, "").slice(0, 34),
          Snippet: source.snippet.slice(0, 90),
        })),
      }),
    },
    {
      id: "research-summary",
      title: "Summary",
      w: 12,
      h: 2,
      tree: component("Markdown", {
        title: `Dashboard: ${research.query}`,
        content: `Built from ${research.sources.length} online sources. Use the selected-widget editor to change any card into a pie, line, bar, table, timeline, or scatter plot.`,
      }),
    },
  ];
}
