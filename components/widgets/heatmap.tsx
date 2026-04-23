"use client";

export interface HeatmapProps {
  title?: string;
  /** N weeks x 7 days, values 0..4 (GitHub-style quantized intensity) */
  grid: number[][];
  legend?: string[];
}

export function HeatmapWidget({ title, grid, legend }: HeatmapProps) {
  const palette = [
    "bg-white/5",
    "bg-violet-900/60",
    "bg-violet-700/70",
    "bg-violet-500/80",
    "bg-fuchsia-400",
  ];
  const weeks = grid.length || 1;
  return (
    <div className="h-full flex flex-col gap-2 min-h-0">
      {title && (
        <div className="text-[11px] uppercase tracking-widest opacity-60 shrink-0">{title}</div>
      )}
      <div
        className="flex-1 min-h-0 min-w-0"
        style={{
          display: "grid",
          gridAutoFlow: "column",
          gridTemplateRows: "repeat(7, minmax(0, 1fr))",
          gridAutoColumns: "minmax(0, 1fr)",
          gap: "3px",
        }}
      >
        {Array.from({ length: weeks * 7 }).map((_, i) => {
          const w = Math.floor(i / 7);
          const d = i % 7;
          const v = grid[w]?.[d] ?? 0;
          return (
            <div
              key={i}
              className={`rounded-[2px] ${palette[Math.max(0, Math.min(4, v))]}`}
              title={`Week ${w + 1}, day ${d + 1}: ${v}`}
              aria-label={`Week ${w + 1}, day ${d + 1}: ${v}`}
            />
          );
        })}
      </div>
      {legend && (
        <div className="flex gap-2 text-[10px] opacity-50 shrink-0">
          {legend.map((l, i) => <span key={i}>{l}</span>)}
        </div>
      )}
    </div>
  );
}
