"use client";

export interface BarChartProps {
  title?: string;
  data: { label: string; value: number }[];
  xLabel?: string;
  yLabel?: string;
  unit?: string;
}

export function BarChartWidget({ title, data, xLabel, yLabel, unit }: BarChartProps) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="h-full flex flex-col">
      {title && <div className="text-[11px] uppercase tracking-widest opacity-60 mb-1">{title}</div>}
      <div className="mb-2 flex justify-between text-[10px] opacity-45">
        <span>{xLabel ?? "category"}</span>
        <span>{yLabel ?? "value"}</span>
      </div>
      <div className="flex-1 flex flex-col gap-1.5 justify-center">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-2">
            <div className="w-28 truncate text-xs opacity-65" title={d.label}>{d.label}</div>
            <div className="flex-1 h-5 bg-current/5 rounded-sm overflow-hidden" aria-label={`${d.label}: ${d.value}${unit ?? ""}`}>
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-cyan-400 rounded-sm transition-[width] duration-500"
                style={{ width: `${(d.value / max) * 100}%` }}
                title={`${d.label}: ${d.value.toLocaleString()}${unit ?? ""}`}
              >
                <span className="sr-only">{d.label}: {d.value}{unit ?? ""}</span>
              </div>
            </div>
            <div className="w-16 text-right text-xs tabular-nums opacity-75">{d.value.toLocaleString()}{unit ?? ""}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
