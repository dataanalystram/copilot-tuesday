"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/",         label: "Studio",   glyph: "◈" },
  { href: "/unplayed", label: "Game Lab", glyph: "⬡" },
];

export default function NavTabs() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed top-0 left-1/2 -translate-x-1/2 z-50 mt-2"
      aria-label="App tabs"
    >
      <div className="flex gap-1 rounded-full border border-white/10 bg-black/60 px-1.5 py-1 backdrop-blur-xl shadow-xl shadow-black/40">
        {TABS.map((tab) => {
          const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`
                flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium
                transition-all duration-200 focus:outline-none focus-visible:ring-2
                focus-visible:ring-violet-400
                ${active
                  ? "bg-violet-500/80 text-white shadow-md shadow-violet-900/40"
                  : "text-white/50 hover:bg-white/5 hover:text-white/80"}
              `}
            >
              <span className="text-[11px]">{tab.glyph}</span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
