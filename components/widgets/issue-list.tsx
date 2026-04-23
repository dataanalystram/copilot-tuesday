"use client";

export interface IssueListProps {
  title?: string;
  items: { number: number; title: string; author: string; state: "open" | "closed" | "merged"; ageDays: number }[];
}

export function IssueList({ title = "Issues", items }: IssueListProps) {
  return (
    <div className="h-full flex flex-col">
      <div className="text-[11px] uppercase tracking-widest text-white/50 mb-2">{title}</div>
      <ul className="flex-1 overflow-auto divide-y divide-white/5">
        {items.map((it) => (
          <li key={it.number} className="py-2 flex items-center gap-3">
            <span className={`h-2 w-2 rounded-full ${it.state === "open" ? "bg-emerald-400" : it.state === "merged" ? "bg-violet-400" : "bg-rose-400"}`} />
            <span className="text-[10px] tabular-nums text-white/40 w-12">#{it.number}</span>
            <span className="flex-1 truncate text-sm text-white/85">{it.title}</span>
            <span className="text-[10px] text-white/40">{it.author}</span>
            <span className="text-[10px] text-white/40 w-12 text-right">{it.ageDays}d</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
