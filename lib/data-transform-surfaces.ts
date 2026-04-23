"use client";

import type { SurfaceMeta } from "./agent-state";
import type { DataTransformResult } from "./research-cache";

function component(name: string, props: Record<string, unknown>): SurfaceMeta["tree"] {
  return { type: "Component", name, props };
}

export function dataTransformToSurfaces(result: DataTransformResult): SurfaceMeta[] {
  const valueColumn = result.valueColumn ?? "value";
  const groupLabel = result.groupBy.length ? result.groupBy.join(" / ") : "row";
  const chartData = result.chartData.slice(0, 18);
  const previewColumns = result.cleanedColumns.slice(0, 8);
  const rows = result.previewRows.slice(0, 12);
  const numericValues = chartData
    .map((row) => toNumber(row.value ?? row[valueColumn] ?? row.y))
    .filter((value) => Number.isFinite(value));
  const total = numericValues.reduce((sum, value) => sum + value, 0);
  const max = numericValues.length ? Math.max(...numericValues) : 0;

  return [
    {
      id: "data-rows-kpi",
      title: "Rows",
      w: 4,
      h: 2,
      tree: component("Kpi", {
        label: "Rows analyzed",
        value: result.rows.toLocaleString(),
        delta: `${result.cleanedColumns.length} columns`,
        trend: "flat",
        hint: result.filename,
      }),
    },
    {
      id: "data-total-kpi",
      title: "Total",
      w: 4,
      h: 2,
      tree: component("Kpi", {
        label: `${result.aggregation} ${valueColumn}`,
        value: formatNumber(total),
        delta: result.groupBy.length ? `by ${groupLabel}` : "visible data",
        trend: "up",
        hint: "Python computed",
      }),
    },
    {
      id: "data-max-kpi",
      title: "Peak",
      w: 4,
      h: 2,
      tree: component("Kpi", {
        label: `Peak ${valueColumn}`,
        value: formatNumber(max),
        delta: result.chartType,
        trend: "up",
        hint: "cleaned data",
      }),
    },
    {
      id: "data-primary-chart",
      title: "Analysis chart",
      w: 7,
      h: 4,
      tree: chartComponent(result, chartData, valueColumn, groupLabel),
      data: {
        sourceRows: result.chartData,
        filename: result.filename,
        task: result.task,
        valueColumn,
        groupBy: result.groupBy,
      },
    },
    {
      id: "data-preview-table",
      title: "Cleaned rows",
      w: 5,
      h: 4,
      tree: component("DataTable", {
        title: "Cleaned preview",
        columns: previewColumns,
        rows: rows.map((row) =>
          Object.fromEntries(previewColumns.map((column) => [column, row[column] ?? ""])),
        ),
      }),
    },
    {
      id: "data-analyst-notes",
      title: "Analyst notes",
      w: 12,
      h: 2,
      tree: component("Markdown", {
        title: "Python analyst run",
        content: [
          `Task: **${result.task || "analyze dataset"}**`,
          `Detected numeric columns: ${result.numericColumns.join(", ") || "none"}.`,
          `Detected date columns: ${result.dateColumns.join(", ") || "none"}.`,
          result.notes.length ? `Cleaning: ${result.notes.join("; ")}.` : "No major cleaning issues found.",
        ].join("\n"),
      }),
    },
  ];
}

function chartComponent(
  result: DataTransformResult,
  chartData: Array<Record<string, string | number>>,
  valueColumn: string,
  groupLabel: string,
): SurfaceMeta["tree"] {
  const title = result.task || `${valueColumn} by ${groupLabel}`;
  if (result.chartType === "PieChart") {
    return component("PieChart", {
      title,
      data: chartData.map((row, index) => ({
        label: String(row.label ?? row[groupLabel] ?? `Slice ${index + 1}`),
        value: toNumber(row.value ?? row[valueColumn]),
      })),
    });
  }
  if (result.chartType === "LineChart") {
    return component("LineChart", {
      title,
      data: chartData.map((row, index) => ({
        x: row.label ?? row.period ?? row.date ?? row[groupLabel] ?? index + 1,
        y: toNumber(row.value ?? row[valueColumn] ?? row.y),
      })),
      xLabel: groupLabel,
      yLabel: valueColumn,
    });
  }
  if (result.chartType === "ScatterPlot") {
    return component("ScatterPlot", {
      title,
      data: chartData.map((row, index) => ({
        x: toNumber(row.x),
        y: toNumber(row.y),
        label: String(row.label ?? `Point ${index + 1}`),
      })),
      xLabel: result.numericColumns[0] ?? "x",
      yLabel: result.numericColumns[1] ?? "y",
    });
  }
  if (result.chartType === "DataTable") {
    const columns = Object.keys(chartData[0] ?? {}).slice(0, 8);
    return component("DataTable", {
      title,
      columns,
      rows: chartData.map((row) =>
        Object.fromEntries(columns.map((column) => [column, row[column] ?? ""])),
      ),
    });
  }
  return component("BarChart", {
    title,
    data: chartData.map((row, index) => ({
      label: String(row.label ?? row[groupLabel] ?? `Row ${index + 1}`),
      value: toNumber(row.value ?? row[valueColumn]),
    })),
    xLabel: groupLabel,
    yLabel: valueColumn,
  });
}

function toNumber(value: unknown) {
  const parsed = Number(String(value ?? "0").replace(/[$,%\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: number) {
  return Math.abs(value) >= 1000
    ? value.toLocaleString(undefined, { maximumFractionDigits: 0 })
    : value.toLocaleString(undefined, { maximumFractionDigits: value % 1 ? 1 : 0 });
}
