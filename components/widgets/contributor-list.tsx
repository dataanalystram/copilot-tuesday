"use client";

export interface ContributorListProps {
  title?: string;
  items: { login: string; avatar?: string; contributions: number }[];
}

export function ContributorList({ title = "Contributors", items }: ContributorListProps) {
  return (
    <div className="h-full flex flex-col">
      <div className="text-[11px] uppercase tracking-widest text-white/50 mb-3">{title}</div>
      <ul className="flex-1 overflow-auto divide-y divide-white/5">
        {items.map((c, i) => (
          <li key={c.login} className="py-2 flex items-center gap-3">
            <span className="w-5 text-[10px] text-white/40 tabular-nums">{i + 1}</span>
            {c.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.avatar} alt="" className="h-7 w-7 rounded-full ring-1 ring-white/10" />
            ) : (
              <div className="h-7 w-7 rounded-full bg-white/10" />
            )}
            <div className="flex-1 text-sm text-white/85 truncate">{c.login}</div>
            <div className="text-xs tabular-nums text-white/60">{c.contributions.toLocaleString()}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
