"use client";

import type { AgentSharedState, SurfaceMeta } from "./agent-state";
import { surfacesStore } from "./surfaces-store";
import { snapshotSurfaces, undoSurfaceChange } from "./surface-history";

const DASHBOARD_RE = /\b(dashboard|widget|widgets|chart|charts|kpi|visuali[sz]e|graph|random data|sample data)\b/i;
const EDIT_RE = /\b(change|edit|update|modify|turn|make|rename|replace|selected|this widget|that widget)\b/i;
const GROUNDING_RE = /\b(research|online|internet|web|ground|grounded|latest|company|topic|url|https?:\/\/)\b/i;
const PRESENTATION_RE = /\b(ppt|powerpoint|presentation|slides?|deck)\b/i;
const RANDOM_RE = /\b(random|sample|fake|dummy|mock)\b/i;

export interface LocalDashboardResult {
  handled: boolean;
  shouldRunAgent: boolean;
  deferred?: boolean;
}

function component(name: string, props: Record<string, unknown>): SurfaceMeta["tree"] {
  return { type: "Component", name, props };
}

function randomBetween(min: number, max: number) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function months() {
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"];
}

function parseCount(message: string) {
  const lower = message.toLowerCase();
  const words: Record<string, number> = {
    one: 1,
    two: 2,
    to: 2,
    too: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
  };
  const digit = lower.match(/\b([1-8])\s+(?:widget|widgets|chart|charts|kpi|cards?)\b/);
  if (digit) return Number(digit[1]);
  for (const [word, count] of Object.entries(words)) {
    if (new RegExp(`\\b${word}\\s+(?:widget|widgets|chart|charts|kpi|cards?)\\b`).test(lower)) {
      return count;
    }
  }
  return 6;
}

function selectedId(state?: AgentSharedState | null) {
  return state?.selection?.surfaceId ?? null;
}

function targetSurfaceId(message: string, state?: AgentSharedState | null) {
  const selected = selectedId(state);
  if (selected) return selected;
  if (!EDIT_RE.test(message) && !/^change\s+to\b/i.test(message.trim())) return null;
  const surfaces = surfacesStore.get();
  const chart = surfaces.find((surface) => {
    const tree = surface.tree;
    return tree.type === "Component" && ["BarChart", "LineChart", "PieChart", "ScatterPlot"].includes(tree.name);
  });
  return chart?.id ?? surfaces[0]?.id ?? null;
}

function nextTrend(base: number) {
  return months().map((month, index) => ({
    x: month,
    y: base + index * randomBetween(160, 620) + randomBetween(-180, 300),
  }));
}

function nextBars(isRepo: boolean) {
  return [
    { label: isRepo ? "Issues" : "Search", value: randomBetween(420, 980) },
    { label: isRepo ? "PRs" : "Direct", value: randomBetween(260, 760) },
    { label: isRepo ? "Forks" : "Social", value: randomBetween(180, 620) },
    { label: isRepo ? "Releases" : "Referral", value: randomBetween(80, 360) },
  ];
}

function componentProps(surface: SurfaceMeta): Record<string, unknown> {
  return surface.tree.type === "Component" ? surface.tree.props : {};
}

function chartRows(surface: SurfaceMeta): Array<{ label: string; value: number }> {
  const props = componentProps(surface);
  const data = Array.isArray(props.data) ? props.data : [];
  if (data.length > 0) {
    const rows = data
      .map((item, index) => {
        if (!item || typeof item !== "object") return null;
        const row = item as Record<string, unknown>;
        const label = String(row.label ?? row.x ?? row.name ?? `Item ${index + 1}`);
        const raw = row.value ?? row.y ?? row.size;
        const value = typeof raw === "number" ? raw : Number(raw);
        return Number.isFinite(value) ? { label, value } : null;
      })
      .filter((item): item is { label: string; value: number } => !!item);
    if (rows.length > 0) return rows;
  }

  const rows = Array.isArray(props.rows) ? props.rows : [];
  const columns = Array.isArray(props.columns) ? props.columns.map(String) : [];
  if (rows.length > 0) {
    const labelColumn = columns[0] ?? "label";
    const valueColumn =
      columns.find((column) => rows.some((row) => Number.isFinite(Number((row as Record<string, unknown>)[column])))) ??
      columns[1];
    const tableRows = rows
      .map((row, index) => {
        const record = row as Record<string, unknown>;
        const value = Number(record[valueColumn]);
        return Number.isFinite(value)
          ? { label: String(record[labelColumn] ?? `Row ${index + 1}`), value }
          : null;
      })
      .filter((item): item is { label: string; value: number } => !!item);
    if (tableRows.length > 0) return tableRows;
  }

  const items = Array.isArray(props.items) ? props.items : [];
  if (items.length > 0) {
    const timelineRows = items
      .map((item, index) => {
        const record = item as Record<string, unknown>;
        const raw = record.value;
        const value = typeof raw === "number" ? raw : Number(String(raw ?? "").replace(/[^\d.-]/g, ""));
        return Number.isFinite(value)
          ? { label: String(record.label ?? record.date ?? `Item ${index + 1}`), value }
          : null;
      })
      .filter((item): item is { label: string; value: number } => !!item);
    if (timelineRows.length > 0) return timelineRows;
  }

  return nextBars(false);
}

function lineRows(surface: SurfaceMeta) {
  const rows = chartRows(surface);
  return rows.map((row) => ({ x: row.label, y: row.value }));
}

function makeSurface(index: number, isRepo: boolean, subject: string): SurfaceMeta {
  const base = isRepo ? randomBetween(114000, 132000) : randomBetween(4200, 9600);
  const kind = index % 9;

  if (kind === 0) {
    return {
      id: `metric-${index + 1}`,
      title: isRepo ? "Repository metric" : "Business metric",
      w: 4,
      h: 2,
      tree: component("Kpi", {
        label: isRepo ? "Stars" : "Revenue",
        value: isRepo ? base.toLocaleString() : `$${base.toLocaleString()}`,
        delta: `+${randomBetween(4, 18)}% this period`,
        trend: "up",
        hint: subject,
      }),
    };
  }

  if (kind === 1) {
    return {
      id: `trend-${index + 1}`,
      title: "Trend",
      w: 6,
      h: 3,
      tree: component("LineChart", {
        title: isRepo ? "Repository momentum" : "Monthly performance",
        data: nextTrend(base),
        unit: isRepo ? "stars" : "USD",
        xLabel: "Month",
        yLabel: isRepo ? "Stars" : "Revenue",
      }),
    };
  }

  if (kind === 2) {
    return {
      id: `breakdown-${index + 1}`,
      title: "Breakdown",
      w: 6,
      h: 3,
      tree: component("BarChart", {
        title: isRepo ? "Work item mix" : "Channel mix",
        data: nextBars(isRepo),
        xLabel: isRepo ? "Type" : "Channel",
        yLabel: "Count",
        unit: "items",
      }),
    };
  }

  if (kind === 3) {
    return {
      id: `quality-${index + 1}`,
      title: "Quality",
      w: 4,
      h: 2,
      tree: component("Kpi", {
        label: isRepo ? "Contributors" : "Conversion",
        value: isRepo ? randomBetween(720, 1300).toLocaleString() : `${randomBetween(7, 15)}.${randomBetween(0, 9)}%`,
        delta: `+${randomBetween(1, 8)} pts`,
        trend: "up",
        hint: "Ready for deeper analysis",
      }),
    };
  }

  if (kind === 4) {
    return {
      id: `share-${index + 1}`,
      title: "Share",
      w: 6,
      h: 3,
      tree: component("PieChart", {
        title: isRepo ? "Issue share by type" : "Market mix",
        data: [
          { label: isRepo ? "Bug" : "Enterprise", value: randomBetween(24, 46) },
          { label: isRepo ? "Feature" : "SMB", value: randomBetween(18, 36) },
          { label: isRepo ? "Docs" : "Consumer", value: randomBetween(12, 28) },
          { label: isRepo ? "Infra" : "Other", value: randomBetween(8, 20) },
        ],
        unit: "%",
      }),
    };
  }

  if (kind === 5) {
    return {
      id: `positioning-${index + 1}`,
      title: "Positioning",
      w: 6,
      h: 3,
      tree: component("ScatterPlot", {
        title: isRepo ? "Complexity vs activity" : "Growth vs efficiency",
        data: Array.from({ length: 10 }, (_, point) => ({
          label: `Segment ${point + 1}`,
          x: randomBetween(10, 95),
          y: randomBetween(15, 98),
          size: randomBetween(5, 12),
        })),
        xLabel: isRepo ? "Complexity" : "Growth",
        yLabel: isRepo ? "Activity" : "Efficiency",
        unit: "%",
      }),
    };
  }

  if (kind === 6) {
    return {
      id: `evidence-${index + 1}`,
      title: "Evidence",
      w: 6,
      h: 3,
      tree: component("DataTable", {
        title: isRepo ? "Evidence table" : "Research rows",
        columns: ["Signal", "Value", "Confidence"],
        rows: [
          { Signal: isRepo ? "Community" : "Demand", Value: randomBetween(72, 96), Confidence: "High" },
          { Signal: isRepo ? "Maintenance" : "Supply", Value: randomBetween(48, 82), Confidence: "Medium" },
          { Signal: isRepo ? "Momentum" : "Competition", Value: randomBetween(55, 88), Confidence: "Medium" },
        ],
      }),
    };
  }

  if (kind === 7) {
    return {
      id: `timeline-${index + 1}`,
      title: "Timeline",
      w: 6,
      h: 3,
      tree: component("Timeline", {
        title: isRepo ? "Activity timeline" : "Market timeline",
        items: [
          { label: "Early signal", date: "2023", value: "Baseline", tone: "neutral" },
          { label: "Acceleration", date: "2024", value: `+${randomBetween(12, 28)}%`, tone: "accent" },
          { label: "Expansion", date: "2025", value: `+${randomBetween(8, 22)}%`, tone: "success" },
          { label: "Current focus", date: "2026", value: "Monitor", tone: "warning" },
        ],
      }),
    };
  }

  return {
    id: `notes-${index + 1}`,
    title: "Notes",
    w: 12,
    h: 2,
    tree: component("Markdown", {
      title: "Analysis notes",
          content: `Initial ${subject} artifact generated on the canvas. Ask for a specific edit, select a widget and say what to change, or request grounded research to replace sample values.`,
    }),
  };
}

function changeSelectedWidget(message: string, state?: AgentSharedState | null): boolean {
  if (/\b(revert|undo|go back|restore)\b/i.test(message)) {
    return undoSurfaceChange();
  }

  const id = targetSurfaceId(message, state);
  if (!id || !EDIT_RE.test(message)) return false;

  const lower = message.toLowerCase();
  const surfaces = surfacesStore.get();
  const current = surfaces.find((surface) => surface.id === id);
  if (!current) return false;

  const base = randomBetween(1000, 9000);
  let updated: SurfaceMeta = {
    ...current,
    title: lower.includes("rename") ? "Renamed insight" : current.title,
  };
  const sourceRows = chartRows(current);
  const sourceLine = lineRows(current);
  const sourceProps = componentProps(current);

  if (/\b(bar|bars|column)\b/.test(lower)) {
    updated = {
      ...updated,
      w: Math.max(updated.w, 6),
      h: Math.max(updated.h, 3),
      tree: component("BarChart", {
        title: String(sourceProps.title ?? "Converted comparison"),
        data: sourceRows,
        xLabel: String(sourceProps.xLabel ?? "Category"),
        yLabel: String(sourceProps.yLabel ?? "Value"),
        unit: String(sourceProps.unit ?? ""),
      }),
    };
  } else if (/\b(line|trend|time)\b/.test(lower)) {
    updated = {
      ...updated,
      w: Math.max(updated.w, 6),
      h: Math.max(updated.h, 3),
      tree: component("LineChart", {
        title: String(sourceProps.title ?? "Converted trend"),
        data: sourceLine,
        xLabel: String(sourceProps.xLabel ?? "Category"),
        yLabel: String(sourceProps.yLabel ?? "Value"),
        unit: String(sourceProps.unit ?? ""),
      }),
    };
  } else if (/\b(pie|donut|share|mix)\b/.test(lower)) {
    updated = {
      ...updated,
      w: Math.max(updated.w, 6),
      h: Math.max(updated.h, 3),
      tree: component("PieChart", {
        title: String(sourceProps.title ?? "Converted share"),
        data: sourceRows,
        unit: String(sourceProps.unit ?? ""),
      }),
    };
  } else if (/\b(scatter|correlation|position)\b/.test(lower)) {
    updated = {
      ...updated,
      w: Math.max(updated.w, 6),
      h: Math.max(updated.h, 3),
      tree: component("ScatterPlot", {
        title: "Updated positioning",
        data: Array.from({ length: 12 }, (_, point) => ({
          label: `Point ${point + 1}`,
          x: randomBetween(5, 95),
          y: randomBetween(5, 95),
          size: randomBetween(5, 13),
        })),
        xLabel: "X score",
        yLabel: "Y score",
      }),
    };
  } else if (/\b(table|rows|evidence)\b/.test(lower)) {
    updated = {
      ...updated,
      w: Math.max(updated.w, 6),
      h: Math.max(updated.h, 3),
      tree: component("DataTable", {
        title: "Updated evidence",
        columns: ["Item", "Value", "Status"],
        rows: [
          { Item: "Signal A", Value: randomBetween(40, 90), Status: "Strong" },
          { Item: "Signal B", Value: randomBetween(20, 80), Status: "Watch" },
          { Item: "Signal C", Value: randomBetween(30, 75), Status: "Open" },
        ],
      }),
    };
  } else if (/\b(timeline|roadmap|events)\b/.test(lower)) {
    updated = {
      ...updated,
      w: Math.max(updated.w, 6),
      h: Math.max(updated.h, 3),
      tree: component("Timeline", {
        title: "Updated timeline",
        items: [
          { label: "Start", date: "Q1", value: "Baseline", tone: "neutral" },
          { label: "Build", date: "Q2", value: "Active", tone: "accent" },
          { label: "Launch", date: "Q3", value: "Target", tone: "success" },
        ],
      }),
    };
  } else if (/\b(kpi|metric|number)\b/.test(lower)) {
    updated = {
      ...updated,
      w: 4,
      h: 2,
      tree: component("Kpi", {
        label: "Updated metric",
        value: base.toLocaleString(),
        delta: `+${randomBetween(2, 15)}%`,
        trend: "up",
        hint: "Changed from the selected widget",
      }),
    };
  } else {
    const existing = current.tree.type === "Component" ? current.tree : null;
    const props = existing && "props" in existing ? existing.props : {};
    updated = {
      ...updated,
      tree: component(existing?.name ?? "Markdown", {
        ...props,
        title: "Updated from selection",
        content: "This selected widget was edited live from the canvas selection.",
      }),
    };
  }

  snapshotSurfaces();
  surfacesStore.set(surfaces.map((surface) => (surface.id === id ? updated : surface)));
  return true;
}

export function handleLocalDashboardCommand(
  message: string,
  state?: AgentSharedState | null,
): LocalDashboardResult {
  if (changeSelectedWidget(message, state)) {
    return { handled: true, shouldRunAgent: false };
  }

  if (PRESENTATION_RE.test(message)) {
    const lower = message.toLowerCase();
    const company = lower.match(/\b(?:for|on|about)\s+([a-z0-9 .-]{2,40})/i)?.[1]?.trim() ?? "the company";
    if (GROUNDING_RE.test(message)) {
      surfacesStore.set([researchingSurface(company, "presentation research")]);
      return { handled: true, shouldRunAgent: true, deferred: true };
    }
    surfacesStore.set([
      {
        id: "deck-brief",
        title: "Deck brief",
        w: 12,
        h: 2,
        tree: component("Markdown", {
          title: "Presentation plan",
          content: `Draft deck for ${company}: company snapshot, market context, product/customer story, traction signals, risks, and recommendation. Ask for grounded research to replace placeholders with sourced evidence.`,
        }),
      },
      {
        id: "slide-structure",
        title: "Slide structure",
        w: 6,
        h: 4,
        tree: component("Markdown", {
          title: "Suggested slides",
          content: [
            "1. Executive summary",
            "2. Company and product overview",
            "3. Market and customer problem",
            "4. Competitive positioning",
            "5. Traction and operating signals",
            "6. Risks, open questions, next steps",
          ].join("\n"),
        }),
      },
      {
        id: "research-scorecard",
        title: "Research scorecard",
        w: 6,
        h: 4,
        tree: component("BarChart", {
          title: "Evidence readiness",
          data: [
            { label: "Company", value: 55 },
            { label: "Market", value: 45 },
            { label: "Traction", value: 35 },
            { label: "Risks", value: 50 },
          ],
          xLabel: "Section",
          yLabel: "Readiness",
          unit: "%",
        }),
      },
    ]);
    return { handled: true, shouldRunAgent: true };
  }

  if (!DASHBOARD_RE.test(message)) {
    return { handled: false, shouldRunAgent: true };
  }

  const lower = message.toLowerCase();
  const isRepo = /github|repo|vercel\/next\.js|next\.js/.test(lower);
  const needsResearch = GROUNDING_RE.test(message) || isRepo;
  if (needsResearch && !RANDOM_RE.test(message)) {
    surfacesStore.set([researchingSurface(extractTopic(message), isRepo ? "repository evidence" : "online research")]);
    return { handled: true, shouldRunAgent: true, deferred: true };
  }
  const subject = isRepo ? "vercel/next.js" : "Sample metrics";
  const count = parseCount(message);
  const surfaces = Array.from({ length: count }, (_, index) => makeSurface(index, isRepo, subject));

  surfacesStore.set(surfaces);

  return {
    handled: true,
    shouldRunAgent: GROUNDING_RE.test(message) || isRepo,
  };
}

export function maybeCreateInstantDashboard(message: string): boolean {
  return handleLocalDashboardCommand(message).handled;
}

function extractTopic(message: string) {
  return message
    .replace(/\b(can you|please|create|make|build|dashboard|research|online|about|on|for|with|data)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "data-rich topic";
}

function researchingSurface(topic: string, mode: string): SurfaceMeta {
  return {
    id: "researching",
    title: "Researching",
    w: 12,
    h: 2,
    tree: component("Markdown", {
      title: "Research in progress",
      content: `Searching for real ${mode} on **${topic}**. The canvas will update with grounded charts and evidence when the agent finishes.`,
    }),
  };
}
