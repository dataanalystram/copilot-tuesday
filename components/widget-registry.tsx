"use client";

/**
 * Widget registry.
 *
 * Two purposes:
 *  1. Export COMPONENT_REGISTRY — the map our lib/a2ui-render.tsx dispatcher
 *     uses to look up `{type:"Component", name:"Kpi", props:{...}}` nodes.
 *  2. Register every widget with CopilotKit's `useComponent` hook so the
 *     agent can also mount them directly in chat messages (v1.52+ feature).
 *
 * Type note: `useComponent<TSchema>` is generic over a Standard-Schema type,
 * NOT over a raw props type — so `useComponent<KpiCardProps>(...)` would be
 * a compile error. We pass no generic and cast inside render. If we later
 * want the model to see typed props in its system prompt, we pass a Zod
 * schema via `parameters:` and the render props are inferred automatically.
 *
 * If you add a new widget: (a) import it, (b) add it to COMPONENT_REGISTRY,
 * (c) add a useComponent(...) call. The agent's system prompt in
 * lib/prompts.ts must also be updated so the model knows it exists.
 */

import React from "react";
import { useComponent } from "@copilotkit/react-core/v2";
import { KpiCard, type KpiCardProps } from "./widgets/kpi-card";
import { LineChartWidget, type LineChartProps } from "./widgets/line-chart";
import { BarChartWidget, type BarChartProps } from "./widgets/bar-chart";
import { HeatmapWidget, type HeatmapProps } from "./widgets/heatmap";
import { ContributorList, type ContributorListProps } from "./widgets/contributor-list";
import { IssueList, type IssueListProps } from "./widgets/issue-list";
import { MarkdownCard, type MarkdownCardProps } from "./widgets/markdown-card";
import { PieChartWidget, type PieChartProps } from "./widgets/pie-chart";
import { ScatterPlotWidget, type ScatterPlotProps } from "./widgets/scatter-plot";
import { DataTableWidget, type DataTableProps } from "./widgets/data-table";
import { TimelineWidget, type TimelineProps } from "./widgets/timeline";
import { MediaCard, type MediaCardProps } from "./widgets/media-card";
import Globe, { type GlobeProps } from "./globe";

// The dispatcher map used by lib/a2ui-render.tsx. Keys MUST match the
// `name` passed to useComponent below AND the COMPONENT_CATALOG listed in
// lib/prompts.ts.
export const COMPONENT_REGISTRY: Record<string, React.ComponentType<any>> = {
  Kpi: KpiCard,
  LineChart: LineChartWidget,
  BarChart: BarChartWidget,
  Heatmap: HeatmapWidget,
  Contributors: ContributorList,
  Issues: IssueList,
  Markdown: MarkdownCard,
  PieChart: PieChartWidget,
  ScatterPlot: ScatterPlotWidget,
  DataTable: DataTableWidget,
  Timeline: TimelineWidget,
  MediaCard: MediaCard,
  Globe: Globe,
};

export default function WidgetRegistry() {
  // Each call below teaches the CopilotKit agent runtime that a named
  // React component exists. The model can then emit A2UI `Component` nodes
  // by name and the renderer will dispatch to these.
  useComponent({
    name: "Kpi",
    description:
      "A single headline metric card. Use for the most important number on a dashboard (e.g. stars, MRR, latency).",
    render: (props) => <KpiCard {...(props as KpiCardProps)} />,
  });
  useComponent({
    name: "LineChart",
    description: "Time-series line chart. Use for trends over days/weeks/months.",
    render: (props) => <LineChartWidget {...(props as LineChartProps)} />,
  });
  useComponent({
    name: "BarChart",
    description: "Categorical bar chart. Use for comparing discrete categories.",
    render: (props) => <BarChartWidget {...(props as BarChartProps)} />,
  });
  useComponent({
    name: "Heatmap",
    description: "GitHub-style contribution heatmap. Use for activity over time.",
    render: (props) => <HeatmapWidget {...(props as HeatmapProps)} />,
  });
  useComponent({
    name: "Contributors",
    description: "Ranked list of contributors with avatar + commit count.",
    render: (props) => <ContributorList {...(props as ContributorListProps)} />,
  });
  useComponent({
    name: "Issues",
    description: "List of issues or PRs with title, state, author, age.",
    render: (props) => <IssueList {...(props as IssueListProps)} />,
  });
  useComponent({
    name: "Markdown",
    description: "A card with markdown content. Use for notes, summaries, or text.",
    render: (props) => <MarkdownCard {...(props as MarkdownCardProps)} />,
  });
  useComponent({
    name: "PieChart",
    description: "Donut chart. Use for shares, mix, market composition, budget allocation, or category percentages.",
    render: (props) => <PieChartWidget {...(props as PieChartProps)} />,
  });
  useComponent({
    name: "ScatterPlot",
    description: "Scatter plot. Use for correlation, positioning maps, company comparisons, or x/y tradeoffs.",
    render: (props) => <ScatterPlotWidget {...(props as ScatterPlotProps)} />,
  });
  useComponent({
    name: "DataTable",
    description: "Compact table. Use for ranked entities, source comparisons, company facts, or raw evidence rows.",
    render: (props) => <DataTableWidget {...(props as DataTableProps)} />,
  });
  useComponent({
    name: "Timeline",
    description: "Timeline/list of dated milestones. Use for events, product launches, market changes, or roadmap beats.",
    render: (props) => <TimelineWidget {...(props as TimelineProps)} />,
  });
  useComponent({
    name: "MediaCard",
    description: "Image or GIF card. Use for user-provided image URLs, generated image outputs, GIF references, logos, screenshots, or visual evidence.",
    render: (props) => <MediaCard {...(props as MediaCardProps)} />,
  });
  useComponent({
    name: "Globe",
    description:
      "3D interactive globe with glowing points for contributor locations or activity hotspots. Visually striking — use sparingly as a hero widget.",
    render: (props) => <Globe {...(props as GlobeProps)} />,
  });

  return null;
}
