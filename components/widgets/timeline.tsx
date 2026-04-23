"use client";

export interface TimelineProps {
  title?: string;
  items: { label: string; date?: string; value?: string | number; tone?: "neutral" | "success" | "warning" | "danger" | "accent" }[];
}

const TONES = {
  neutral: "border-white/20 bg-white/8 text-white/70",
  success: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
  warning: "border-amber-300/25 bg-amber-300/10 text-amber-100",
  danger: "border-rose-300/25 bg-rose-300/10 text-rose-100",
  accent: "border-cyan-300/25 bg-cyan-300/10 text-cyan-100",
};

export function TimelineWidget({ title, items }: TimelineProps) {
  return (
    <div className="flex h-full flex-col">
      {title && <div className="mb-2 text-[11px] uppercase tracking-widest opacity-60">{title}</div>}
      <div className="min-h-0 flex-1 overflow-auto">
        <ol className="relative ml-3 space-y-2 border-l border-white/10 pl-4">
          {items.map((item, index) => {
            const tone = item.tone ?? "neutral";
            return (
              <li key={`${item.label}-${index}`} className={`relative rounded-md border px-3 py-2 ${TONES[tone]}`} title={`${item.date ?? ""} ${item.label} ${item.value ?? ""}`}>
                <span className="absolute -left-[22px] top-3 h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.6)]" />
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{item.label}</span>
                  {item.value !== undefined && <span className="font-mono text-xs opacity-65">{item.value}</span>}
                </div>
                {item.date && <div className="mt-0.5 text-[10px] uppercase tracking-wider opacity-45">{item.date}</div>}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
