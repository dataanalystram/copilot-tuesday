"use client";

import type { SurfaceMeta } from "./agent-state";
import { surfacesStore } from "./surfaces-store";
import type { TextAttachment } from "./attachment-store";

function component(name: string, props: Record<string, unknown>): SurfaceMeta["tree"] {
  return { type: "Component", name, props };
}

export function maybeBuildCsvDashboard(attachments: TextAttachment[]) {
  const file = attachments.find((attachment) => /\.(csv|tsv)$/i.test(attachment.filename));
  if (!file) return false;
  const delimiter = /\.tsv$/i.test(file.filename) ? "\t" : ",";
  const rows = parseDelimited(file.content, delimiter);
  if (rows.length === 0) return false;

  const columns = Object.keys(rows[0]);
  const numeric = columns.filter((column) => rows.some((row) => Number.isFinite(toNumber(row[column]))));
  const categorical = columns.filter((column) => !numeric.includes(column));
  const valueColumn = numeric[0] ?? columns[1];
  const labelColumn = categorical[0] ?? columns[0];
  const values = rows.map((row) => toNumber(row[valueColumn])).filter((value) => Number.isFinite(value));
  const total = values.reduce((sum, value) => sum + value, 0);
  const avg = values.length ? total / values.length : 0;
  const max = values.length ? Math.max(...values) : 0;
  const chartRows = rows
    .slice(0, 10)
    .map((row, index) => ({
      label: String(row[labelColumn] ?? `Row ${index + 1}`),
      value: toNumber(row[valueColumn]),
    }))
    .filter((row) => Number.isFinite(row.value));

  surfacesStore.set([
    {
      id: "csv-rows-kpi",
      title: "Rows",
      w: 4,
      h: 2,
      tree: component("Kpi", {
        label: "Rows",
        value: rows.length.toLocaleString(),
        delta: `${columns.length} columns`,
        trend: "flat",
        hint: file.filename,
      }),
    },
    {
      id: "csv-total-kpi",
      title: "Total",
      w: 4,
      h: 2,
      tree: component("Kpi", {
        label: `Total ${valueColumn}`,
        value: format(total),
        delta: `avg ${format(avg)}`,
        trend: "up",
        hint: "computed locally",
      }),
    },
    {
      id: "csv-max-kpi",
      title: "Max",
      w: 4,
      h: 2,
      tree: component("Kpi", {
        label: `Max ${valueColumn}`,
        value: format(max),
        delta: labelColumn,
        trend: "up",
        hint: "computed locally",
      }),
    },
    {
      id: "csv-bar",
      title: "Data comparison",
      w: 6,
      h: 3,
      tree: component("BarChart", {
        title: `${valueColumn} by ${labelColumn}`,
        data: chartRows,
        xLabel: labelColumn,
        yLabel: valueColumn,
      }),
    },
    {
      id: "csv-line",
      title: "Data trend",
      w: 6,
      h: 3,
      tree: component("LineChart", {
        title: `${valueColumn} trend`,
        data: chartRows.map((row) => ({ x: row.label, y: row.value })),
        xLabel: labelColumn,
        yLabel: valueColumn,
      }),
    },
    {
      id: "csv-table",
      title: "Preview",
      w: 12,
      h: 3,
      tree: component("DataTable", {
        title: file.filename,
        columns,
        rows: rows.slice(0, 10),
      }),
    },
  ]);
  return true;
}

function parseDelimited(content: string, delimiter: string) {
  const lines = content.trim().split(/\r?\n/).filter(Boolean);
  const headers = splitLine(lines[0], delimiter);
  return lines.slice(1).map((line) => {
    const cells = splitLine(line, delimiter);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
}

function splitLine(line: string, delimiter: string) {
  return line.split(delimiter).map((value) => value.trim().replace(/^"|"$/g, ""));
}

function toNumber(value: unknown) {
  return Number(String(value ?? "").replace(/[$,%\s]/g, ""));
}

function format(value: number) {
  return Math.abs(value) >= 1000 ? value.toLocaleString(undefined, { maximumFractionDigits: 0 }) : value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}
