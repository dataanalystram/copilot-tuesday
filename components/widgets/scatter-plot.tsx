"use client";

export interface ScatterPlotProps {
  title?: string;
  data: { x: number; y: number; label?: string; size?: number }[];
  xLabel?: string;
  yLabel?: string;
  unit?: string;
}

export function ScatterPlotWidget({ title, data, xLabel, yLabel, unit }: ScatterPlotProps) {
  const xs = data.map((d) => d.x);
  const ys = data.map((d) => d.y);
  const xmin = Math.min(...xs, 0);
  const xmax = Math.max(...xs, 1);
  const ymin = Math.min(...ys, 0);
  const ymax = Math.max(...ys, 1);
  const w = 640;
  const h = 260;
  const pad = 42;
  const sx = (x: number) => pad + ((x - xmin) / Math.max(1e-6, xmax - xmin)) * (w - pad * 2);
  const sy = (y: number) => h - pad - ((y - ymin) / Math.max(1e-6, ymax - ymin)) * (h - pad * 2);

  return (
    <div className="flex h-full flex-col">
      {title && <div className="mb-2 text-[11px] uppercase tracking-widest opacity-60">{title}</div>}
      <svg viewBox={`0 0 ${w} ${h}`} className="min-h-0 flex-1" role="img" aria-label={title ?? "Scatter plot"}>
        <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="currentColor" strokeOpacity="0.18" />
        <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="currentColor" strokeOpacity="0.18" />
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={pad} y1={pad + t * (h - pad * 2)} x2={w - pad} y2={pad + t * (h - pad * 2)} stroke="currentColor" strokeOpacity="0.08" />
            <line x1={pad + t * (w - pad * 2)} y1={pad} x2={pad + t * (w - pad * 2)} y2={h - pad} stroke="currentColor" strokeOpacity="0.08" />
          </g>
        ))}
        {data.map((d, index) => (
          <circle key={`${d.label ?? "point"}-${index}`} cx={sx(d.x)} cy={sy(d.y)} r={Math.max(4, Math.min(14, d.size ?? 7))} fill="#67e8f9" fillOpacity="0.72" stroke="#a78bfa" strokeWidth="1.5">
            <title>{`${d.label ?? `Point ${index + 1}`}: ${xLabel ?? "x"} ${d.x}, ${yLabel ?? "y"} ${d.y}${unit ?? ""}`}</title>
          </circle>
        ))}
        <text x={pad} y={h - 9} fontSize="10" fill="currentColor" opacity="0.55">{xLabel ?? "x-axis"}</text>
        <text x={9} y={pad - 8} fontSize="10" fill="currentColor" opacity="0.55">{yLabel ?? "y-axis"}</text>
      </svg>
    </div>
  );
}
