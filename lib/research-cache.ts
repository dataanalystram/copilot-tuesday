export interface ResearchResult {
  query: string;
  sources: Array<{ title: string; url: string; snippet: string }>;
  metrics: Array<{ label: string; value: number; unit?: string; note?: string }>;
  categories: Array<{ label: string; value: number }>;
  timeline: Array<{ label: string; date: string; value?: string }>;
}

export interface DataTransformResult {
  filename: string;
  task: string;
  rows: number;
  columns: string[];
  cleanedColumns: string[];
  dateColumns: string[];
  numericColumns: string[];
  categoryColumns: string[];
  groupBy: string[];
  valueColumn?: string;
  aggregation: "sum" | "mean" | "count" | "min" | "max";
  chartType: "Kpi" | "LineChart" | "BarChart" | "PieChart" | "ScatterPlot" | "DataTable";
  chartData: Array<Record<string, string | number>>;
  previewRows: Array<Record<string, string | number>>;
  notes: string[];
}

let latest: { id: number; result: ResearchResult; createdAt: string } | null = null;
let latestTransform: { id: number; result: DataTransformResult; createdAt: string } | null = null;

export function setLatestResearch(result: ResearchResult) {
  latest = {
    id: Date.now(),
    result,
    createdAt: new Date().toISOString(),
  };
  return latest;
}

export function getLatestResearch() {
  return latest;
}

export function setLatestTransform(result: DataTransformResult) {
  latestTransform = {
    id: Date.now(),
    result,
    createdAt: new Date().toISOString(),
  };
  return latestTransform;
}

export function getLatestTransform() {
  return latestTransform;
}
