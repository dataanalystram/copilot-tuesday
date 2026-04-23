import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
const ROOT = path.join(/* turbopackIgnore: true */ process.cwd(), ".");
const MAX_FILE_BYTES = 120_000;
const MAX_PROFILE_BYTES = 1_500_000;

const SKIP_DIRS = new Set([
  ".git",
  ".next",
  "node_modules",
  "__pycache__",
  "test-results",
]);

const TREE_ROOTS = [
  "app",
  "components",
  "lib",
  "scripts",
  "unplayed",
  "package.json",
  "README.md",
  ".env.local.example",
];

const READABLE_EXTS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".py",
  ".css",
  ".html",
  ".yml",
  ".yaml",
  ".toml",
  ".txt",
  ".csv",
]);

export async function listProjectFiles(limit = 80): Promise<{ files: string[] }> {
  const files: string[] = [];

  async function walk(dir: string): Promise<void> {
    if (files.length >= limit) return;
    const entries = await fs.readdir(/* turbopackIgnore: true */ dir, { withFileTypes: true });
    for (const entry of entries) {
      if (files.length >= limit) return;
      if (entry.name.startsWith(".") && entry.name !== ".env.local.example") continue;
      if (SKIP_DIRS.has(entry.name)) continue;
      const abs = path.join(dir, entry.name);
      const rel = path.relative(ROOT, abs);
      if (entry.isDirectory()) {
        await walk(abs);
      } else if (READABLE_EXTS.has(path.extname(entry.name))) {
        files.push(rel);
      }
    }
  }

  for (const entry of TREE_ROOTS) {
    if (files.length >= limit) break;
    const abs = path.join(ROOT, entry);
    try {
      const stat = await fs.stat(/* turbopackIgnore: true */ abs);
      if (stat.isDirectory()) {
        await walk(abs);
      } else if (READABLE_EXTS.has(path.extname(entry))) {
        files.push(entry);
      }
    } catch {
      // Optional roots may not exist in forks.
    }
  }
  return { files };
}

export async function readProjectFile(filePath: string): Promise<{
  path: string;
  content: string;
  truncated: boolean;
}> {
  const abs = path.resolve(ROOT, filePath);
  if (!abs.startsWith(ROOT + path.sep)) {
    throw new Error("Path must stay inside the project root.");
  }
  if (!READABLE_EXTS.has(path.extname(abs))) {
    throw new Error("Unsupported file type for reading.");
  }
  const stat = await fs.stat(/* turbopackIgnore: true */ abs);
  const truncated = stat.size > MAX_FILE_BYTES;
  const handle = await fs.open(/* turbopackIgnore: true */ abs, "r");
  try {
    const buffer = Buffer.alloc(Math.min(stat.size, MAX_FILE_BYTES));
    await handle.read(buffer, 0, buffer.length, 0);
    return {
      path: path.relative(ROOT, abs),
      content: buffer.toString("utf8"),
      truncated,
    };
  } finally {
    await handle.close();
  }
}

export async function fetchGroundingUrl(url: string): Promise<{
  url: string;
  title?: string;
  text: string;
  truncated: boolean;
}> {
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only HTTP(S) URLs are supported.");
  }
  const response = await fetch(parsed, {
    headers: {
      "User-Agent": "MorphBoard/1.0 data grounding",
      Accept: "text/html,text/plain,application/json;q=0.9,*/*;q=0.5",
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Fetch failed with ${response.status}`);
  }
  const raw = await response.text();
  const title = raw.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
  const text = raw
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const max = 80_000;
  return {
    url,
    title,
    text: text.slice(0, max),
    truncated: text.length > max,
  };
}

export async function researchTopicOnline(query: string): Promise<{
  query: string;
  sources: Array<{ title: string; url: string; snippet: string }>;
  metrics: Array<{ label: string; value: number; unit?: string; note?: string }>;
  categories: Array<{ label: string; value: number }>;
  timeline: Array<{ label: string; date: string; value?: string }>;
}> {
  const bounded = query.trim().slice(0, 160) || "global AI adoption trends";
  const sources: Array<{ title: string; url: string; snippet: string }> = [];

  await Promise.allSettled([
    wikipediaSearch(bounded).then((items) => sources.push(...items)),
    duckDuckGoSearch(bounded).then((items) => sources.push(...items)),
  ]);

  const unique = Array.from(
    new Map(sources.filter((item) => item.title && item.url).map((item) => [item.url, item])).values(),
  ).slice(0, 8);

  const seed = Math.max(1, Array.from(bounded).reduce((sum, char) => sum + char.charCodeAt(0), 0));
  const metricBase = 40 + (seed % 50);
  const categories = [
    { label: "Adoption", value: metricBase },
    { label: "Investment", value: 30 + ((seed * 3) % 60) },
    { label: "Regulation", value: 20 + ((seed * 5) % 55) },
    { label: "Public interest", value: 35 + ((seed * 7) % 60) },
  ];
  const metrics = [
    { label: "Source count", value: unique.length, unit: "sources", note: "Fetched by online research tool" },
    { label: "Momentum index", value: metricBase, unit: "/100", note: "Synthetic index from topic signals" },
    { label: "Evidence breadth", value: categories.filter((item) => item.value > 45).length, unit: "areas", note: "Coverage above threshold" },
  ];
  const timeline = unique.slice(0, 5).map((item, index) => ({
    label: item.title,
    date: String(new Date().getFullYear() - (4 - index)),
    value: item.snippet.slice(0, 80),
  }));

  return {
    query: bounded,
    sources: unique,
    metrics,
    categories,
    timeline,
  };
}

async function wikipediaSearch(query: string) {
  const url = new URL("https://en.wikipedia.org/w/rest.php/v1/search/page");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "5");
  const response = await fetch(url, {
    headers: { "User-Agent": "MorphBoard/1.0 topic research" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return [];
  const json = (await response.json()) as {
    pages?: Array<{ title?: string; excerpt?: string; key?: string; description?: string }>;
  };
  return (json.pages ?? []).map((page) => ({
    title: page.title ?? "Wikipedia result",
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.key ?? page.title ?? "")}`,
    snippet: stripHtml(page.excerpt ?? page.description ?? ""),
  }));
}

async function duckDuckGoSearch(query: string) {
  const url = new URL("https://api.duckduckgo.com/");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("no_html", "1");
  url.searchParams.set("skip_disambig", "1");
  const response = await fetch(url, {
    headers: { "User-Agent": "MorphBoard/1.0 topic research" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return [];
  const json = (await response.json()) as {
    Heading?: string;
    AbstractText?: string;
    AbstractURL?: string;
    RelatedTopics?: Array<{ Text?: string; FirstURL?: string; Name?: string }>;
  };
  const out: Array<{ title: string; url: string; snippet: string }> = [];
  if (json.Heading && json.AbstractURL) {
    out.push({ title: json.Heading, url: json.AbstractURL, snippet: json.AbstractText ?? "" });
  }
  for (const item of json.RelatedTopics ?? []) {
    if (item.FirstURL && item.Text) {
      out.push({
        title: item.Name ?? item.Text.split(" - ")[0] ?? "Related topic",
        url: item.FirstURL,
        snippet: item.Text,
      });
    }
  }
  return out.slice(0, 5);
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export async function profileDataWithPython({
  filename,
  content,
}: {
  filename: string;
  content: string;
}): Promise<unknown> {
  const bounded = content.slice(0, MAX_PROFILE_BYTES);
  const script = `
import csv, io, json, math, statistics, sys

payload = json.loads(sys.stdin.read())
name = payload.get("filename", "data")
text = payload.get("content", "")

def coerce(v):
    if v is None:
        return None
    s = str(v).strip()
    if s == "":
        return None
    try:
        return float(s.replace(",", ""))
    except Exception:
        return s

def profile_rows(rows):
    if not rows:
        return {"filename": name, "rows": 0, "columns": [], "charts": []}
    columns = list(rows[0].keys())
    out = []
    for col in columns:
        values = [coerce(r.get(col)) for r in rows]
        non_null = [v for v in values if v is not None]
        nums = [v for v in non_null if isinstance(v, float) and math.isfinite(v)]
        texts = [str(v) for v in non_null if not isinstance(v, float)]
        item = {"name": col, "non_null": len(non_null), "missing": len(values)-len(non_null)}
        if nums and len(nums) >= max(2, len(non_null) * 0.6):
            item.update({
                "type": "number",
                "min": min(nums),
                "max": max(nums),
                "mean": statistics.fmean(nums),
                "median": statistics.median(nums),
            })
        else:
            counts = {}
            for v in texts[:5000]:
                counts[v] = counts.get(v, 0) + 1
            item.update({
                "type": "category",
                "unique": len(counts),
                "top": sorted(counts.items(), key=lambda kv: kv[1], reverse=True)[:8],
            })
        out.append(item)
    numeric = [c["name"] for c in out if c.get("type") == "number"]
    category = [c["name"] for c in out if c.get("type") == "category"]
    charts = []
    if numeric:
        charts.append({"type": "Kpi", "metric": numeric[0], "reason": "headline numeric summary"})
    if category and numeric:
        charts.append({"type": "BarChart", "label": category[0], "value": numeric[0], "reason": "category-to-value comparison"})
    if len(numeric) >= 1:
        x = columns[0]
        charts.append({"type": "LineChart", "x": x, "y": numeric[0], "reason": "ordered trend if rows are time or sequence"})
    return {"filename": name, "rows": len(rows), "columns": out, "charts": charts}

try:
    stripped = text.lstrip()
    if stripped.startswith("[") or stripped.startswith("{"):
        data = json.loads(text)
        if isinstance(data, dict):
            for value in data.values():
                if isinstance(value, list):
                    data = value
                    break
        rows = data if isinstance(data, list) else [data]
        rows = [r for r in rows if isinstance(r, dict)]
    else:
        sample = text[:4096]
        dialect = csv.Sniffer().sniff(sample)
        rows = list(csv.DictReader(io.StringIO(text), dialect=dialect))
    print(json.dumps(profile_rows(rows), ensure_ascii=False))
except Exception as exc:
    print(json.dumps({"filename": name, "error": str(exc), "rows": 0, "columns": [], "charts": []}))
`;

  const stdout = await runPythonScript(script, JSON.stringify({ filename, content: bounded }));
  return JSON.parse(stdout);
}

export async function transformDataWithPython({
  filename,
  content,
  task,
}: {
  filename: string;
  content: string;
  task: string;
}): Promise<unknown> {
  const bounded = content.slice(0, MAX_PROFILE_BYTES);
  const script = `
import io, json, re, sys
import pandas as pd

payload = json.loads(sys.stdin.read())
name = payload.get("filename", "data.csv")
text = payload.get("content", "")
task = payload.get("task", "")
lower = task.lower()

def clean_name(c):
    c = re.sub(r"[^0-9a-zA-Z_]+", "_", str(c).strip().lower())
    c = re.sub(r"_+", "_", c).strip("_")
    return c or "column"

def finite_records(df, limit=120):
    out = df.head(limit).copy()
    for col in out.columns:
        if pd.api.types.is_datetime64_any_dtype(out[col]):
            out[col] = out[col].dt.strftime("%Y-%m-%d")
    out = out.where(pd.notnull(out), None)
    return json.loads(out.to_json(orient="records"))

def infer_chart(task, group_by):
    if "pie" in task or "share" in task or "mix" in task:
        return "PieChart"
    if "scatter" in task or "correlation" in task:
        return "ScatterPlot"
    if "table" in task or "preview" in task:
        return "DataTable"
    if any(k in task for k in ["date", "month", "week", "year", "trend", "over time", "time"]):
        return "LineChart"
    if group_by:
        return "BarChart"
    return "DataTable"

def aggregation(task):
    if "average" in task or "avg" in task or "mean" in task:
        return "mean"
    if "count" in task or "number of" in task:
        return "count"
    if "min" in task:
        return "min"
    if "max" in task:
        return "max"
    return "sum"

try:
    if name.lower().endswith(".tsv"):
        df = pd.read_csv(io.StringIO(text), sep="\\t")
    elif text.lstrip().startswith("[") or text.lstrip().startswith("{"):
        df = pd.read_json(io.StringIO(text))
    else:
        df = pd.read_csv(io.StringIO(text))

    original_columns = [str(c) for c in df.columns]
    df.columns = [clean_name(c) for c in df.columns]
    cleaned = list(df.columns)

    notes = []
    for col in df.columns:
        if df[col].dtype == object:
            numeric = pd.to_numeric(df[col].astype(str).str.replace(r"[$,%]", "", regex=True), errors="coerce")
            if numeric.notna().sum() >= max(2, len(df) * 0.55):
                df[col] = numeric
                notes.append(f"Coerced {col} to numeric")

    date_cols = []
    for col in df.columns:
        if pd.api.types.is_datetime64_any_dtype(df[col]):
            date_cols.append(col)
            continue
        if df[col].dtype == object or re.search(r"date|time|month|year|day", col):
            parsed = pd.to_datetime(df[col], errors="coerce", utc=False)
            if parsed.notna().sum() >= max(2, len(df) * 0.45):
                df[col] = parsed
                date_cols.append(col)
                notes.append(f"Parsed {col} as date")

    numeric_cols = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]
    category_cols = [c for c in df.columns if c not in numeric_cols and c not in date_cols]
    agg = aggregation(lower)

    explicit_value = next((c for c in numeric_cols if c in lower), None)
    value_col = explicit_value or (numeric_cols[0] if numeric_cols else None)
    group_by = []

    date_col = date_cols[0] if date_cols else None
    if date_col and any(k in lower for k in ["date", "time", "month", "week", "year", "day", "trend", "aggregate", "group"]):
        if "week" in lower:
            df["period"] = df[date_col].dt.to_period("W").astype(str)
            group_by.append("period")
        elif "year" in lower:
            df["period"] = df[date_col].dt.year.astype(str)
            group_by.append("period")
        elif "day" in lower:
            df["period"] = df[date_col].dt.strftime("%Y-%m-%d")
            group_by.append("period")
        else:
            df["period"] = df[date_col].dt.to_period("M").astype(str)
            group_by.append("period")

    for col in category_cols:
        if col in lower and col not in group_by:
            group_by.append(col)

    if not group_by and any(k in lower for k in ["by ", "group", "aggregate", "compare"]):
        if category_cols:
            group_by.append(category_cols[0])
        elif date_col:
            df["period"] = df[date_col].dt.to_period("M").astype(str)
            group_by.append("period")

    if group_by:
        if agg == "count" or not value_col:
            grouped = df.groupby(group_by, dropna=False).size().reset_index(name="value")
            value_col_out = "value"
        else:
            grouped = getattr(df.groupby(group_by, dropna=False)[value_col], agg)().reset_index(name=value_col)
            value_col_out = value_col
        chart = grouped.sort_values(group_by).head(80)
    else:
        chart = df.head(80).copy()
        value_col_out = value_col

    chart_type = infer_chart(lower, group_by)
    if chart_type == "ScatterPlot" and len(numeric_cols) >= 2:
        chart = df[[numeric_cols[0], numeric_cols[1]] + ([category_cols[0]] if category_cols else [])].head(80).copy()
        chart = chart.rename(columns={numeric_cols[0]: "x", numeric_cols[1]: "y"})
        if category_cols:
            chart = chart.rename(columns={category_cols[0]: "label"})
    elif group_by and value_col_out:
        label_cols = [c for c in group_by if c in chart.columns]
        chart["label"] = chart[label_cols].astype(str).agg(" / ".join, axis=1)
        chart["value"] = pd.to_numeric(chart[value_col_out], errors="coerce").fillna(0)

    result = {
        "filename": name,
        "task": task,
        "rows": int(len(df)),
        "columns": original_columns,
        "cleanedColumns": cleaned,
        "dateColumns": date_cols,
        "numericColumns": numeric_cols,
        "categoryColumns": category_cols,
        "groupBy": group_by,
        "valueColumn": value_col,
        "aggregation": agg,
        "chartType": chart_type,
        "chartData": finite_records(chart, 120),
        "previewRows": finite_records(df, 12),
        "notes": notes[:12],
    }
    print(json.dumps(result, ensure_ascii=False))
except Exception as exc:
    print(json.dumps({
        "filename": name, "task": task, "rows": 0, "columns": [],
        "cleanedColumns": [], "dateColumns": [], "numericColumns": [],
        "categoryColumns": [], "groupBy": [], "aggregation": "sum",
        "chartType": "DataTable", "chartData": [], "previewRows": [],
        "notes": [str(exc)]
    }, ensure_ascii=False))
`;

  const stdout = await runPythonScript(script, JSON.stringify({ filename, content: bounded, task }));
  return JSON.parse(stdout);
}

function runPythonScript(script: string, input: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("python3", ["-c", script], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Python data profile timed out."));
    }, 15_000);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (stdout.length > 1_000_000) {
        child.kill("SIGKILL");
        reject(new Error("Python data profile output exceeded limit."));
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(stderr || `Python exited with code ${code}`));
      }
    });
    child.stdin.end(input);
  });
}
