"use client";
import { useMemo } from "react";

export interface LineChartProps {
  title?: string;
  data: { x: string | number; y: number }[];
  unit?: string;
  xLabel?: string;
  yLabel?: string;
}

export function LineChartWidget({ title, data, unit, xLabel, yLabel }: LineChartProps) {
  const { path, points, ymin, ymax, w, h, pad } = useMemo(() => {
    const w = 640, h = 240, pad = 38;
    if (!data?.length) return { path: "", points: [], ymin: 0, ymax: 0, w, h, pad };
    const ys = data.map((d) => d.y);
    const ymin = Math.min(...ys);
    const ymax = Math.max(...ys);
    const span = Math.max(1e-6, ymax - ymin);
    const pts = data.map((d, i) => {
      const x = pad + (i / Math.max(1, data.length - 1)) * (w - 2 * pad);
      const y = h - pad - ((d.y - ymin) / span) * (h - 2 * pad);
      return [x, y] as const;
    });
    const path = pts
      .map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`))
      .join(" ");
    return { path, points: pts, ymin, ymax, w, h, pad };
  }, [data]);

  return (
    <div className="h-full flex flex-col">
      {title && <div className="text-[11px] uppercase tracking-widest opacity-60 mb-2">{title}</div>}
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" role="img" aria-label={title ?? "Line chart"}>
        <defs>
          <linearGradient id="lc" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="currentColor" strokeOpacity="0.18" />
        <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="currentColor" strokeOpacity="0.18" />
        {[0, 0.5, 1].map((t) => {
          const y = h - pad - t * (h - 2 * pad);
          const value = ymin + t * (ymax - ymin);
          return (
            <g key={t}>
              <line x1={pad} y1={y} x2={w - pad} y2={y} stroke="currentColor" strokeOpacity="0.08" />
              <text x={pad - 8} y={y + 4} textAnchor="end" fontSize="10" fill="currentColor" opacity="0.55">
                {formatNumber(value)}
              </text>
            </g>
          );
        })}
        <path d={path} fill="none" stroke="#a78bfa" strokeWidth="2" />
        <path d={`${path} L${w - 24},${h - 24} L24,${h - 24} Z`} fill="url(#lc)" />
        {points.map(([x, y], i) => {
          const d = data[i];
          return (
            <circle key={i} cx={x} cy={y} r="4" fill="#c4b5fd" stroke="#111827" strokeWidth="1">
              <title>{`${xLabel ?? "x"}: ${d.x} · ${yLabel ?? title ?? "value"}: ${formatNumber(d.y)}${unit ?? ""}`}</title>
            </circle>
          );
        })}
        {data.length > 0 && (
          <>
            <text x={pad} y={h - 8} fontSize="10" fill="currentColor" opacity="0.58">
              {String(data[0].x)}
            </text>
            <text x={w - pad} y={h - 8} textAnchor="end" fontSize="10" fill="currentColor" opacity="0.58">
              {String(data[data.length - 1].x)}
            </text>
          </>
        )}
      </svg>
      <div className="flex justify-between text-[10px] opacity-55 mt-1">
        <span>{xLabel ?? "x-axis"}</span>
        <span>{yLabel ?? "value"} · min {formatNumber(ymin)}{unit ?? ""} · max {formatNumber(ymax)}{unit ?? ""}</span>
      </div>
    </div>
  );
}

function formatNumber(value: number): string {
  return Math.abs(value) >= 1000 ? value.toLocaleString(undefined, { maximumFractionDigits: 0 }) : value.toFixed(value % 1 ? 1 : 0);
}
