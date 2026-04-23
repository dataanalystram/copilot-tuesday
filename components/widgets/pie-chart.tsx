"use client";

export interface PieChartProps {
  title?: string;
  data: { label: string; value: number; color?: string }[];
  unit?: string;
}

const COLORS = ["#22d3ee", "#a78bfa", "#34d399", "#f59e0b", "#fb7185", "#60a5fa", "#f472b6", "#bef264"];

export function PieChartWidget({ title, data, unit }: PieChartProps) {
  const total = Math.max(1, data.reduce((sum, item) => sum + Math.max(0, item.value), 0));
  let acc = 0;
  const segments = data.map((item, index) => {
    const value = Math.max(0, item.value);
    const start = acc / total;
    acc += value;
    const end = acc / total;
    return { ...item, value, start, end, color: item.color ?? COLORS[index % COLORS.length] };
  });

  return (
    <div className="flex h-full flex-col">
      {title && <div className="mb-2 text-[11px] uppercase tracking-widest opacity-60">{title}</div>}
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(130px,1fr)_minmax(120px,0.9fr)] items-center gap-4">
        <svg viewBox="-120 -120 240 240" className="h-full min-h-[150px] w-full" role="img" aria-label={title ?? "Pie chart"}>
          <circle r="82" fill="rgba(255,255,255,0.04)" />
          {segments.map((segment) => (
            <path key={segment.label} d={arc(segment.start, segment.end, 88, 52)} fill={segment.color}>
              <title>{`${segment.label}: ${format(segment.value)}${unit ?? ""} (${Math.round((segment.value / total) * 100)}%)`}</title>
            </path>
          ))}
          <circle r="48" fill="rgba(5,7,13,0.92)" />
          <text y="-4" textAnchor="middle" className="fill-white text-[20px] font-semibold">
            {format(total)}
          </text>
          <text y="17" textAnchor="middle" className="fill-white/50 text-[10px] uppercase tracking-widest">
            total
          </text>
        </svg>
        <div className="min-w-0 space-y-1.5">
          {segments.map((segment) => (
            <div key={segment.label} className="flex items-center gap-2 text-xs" title={`${segment.label}: ${format(segment.value)}${unit ?? ""}`}>
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: segment.color }} />
              <span className="min-w-0 flex-1 truncate text-white/70">{segment.label}</span>
              <span className="font-mono text-white/50">{Math.round((segment.value / total) * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function arc(start: number, end: number, outer: number, inner: number) {
  const large = end - start > 0.5 ? 1 : 0;
  const a0 = start * Math.PI * 2 - Math.PI / 2;
  const a1 = end * Math.PI * 2 - Math.PI / 2;
  const p0 = [Math.cos(a0) * outer, Math.sin(a0) * outer];
  const p1 = [Math.cos(a1) * outer, Math.sin(a1) * outer];
  const p2 = [Math.cos(a1) * inner, Math.sin(a1) * inner];
  const p3 = [Math.cos(a0) * inner, Math.sin(a0) * inner];
  return `M ${p0[0]} ${p0[1]} A ${outer} ${outer} 0 ${large} 1 ${p1[0]} ${p1[1]} L ${p2[0]} ${p2[1]} A ${inner} ${inner} 0 ${large} 0 ${p3[0]} ${p3[1]} Z`;
}

function format(value: number) {
  return value >= 1000 ? value.toLocaleString(undefined, { maximumFractionDigits: 0 }) : value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}
