"use client";

export interface MarkdownCardProps {
  title?: string;
  /** Lightweight markdown: only #, ##, **bold**, _italic_, `code`, lists, links. */
  content: string;
}

export function MarkdownCard({ title, content }: MarkdownCardProps) {
  return (
    <div className="h-full flex flex-col">
      {title && <div className="text-[11px] uppercase tracking-widest text-white/50 mb-2">{title}</div>}
      <div
        className="prose prose-invert prose-sm max-w-none text-white/80 text-sm leading-relaxed"
        dangerouslySetInnerHTML={{ __html: mini(content) }}
      />
    </div>
  );
}

function mini(md: string): string {
  return md
    .replace(/^### (.*)$/gm, "<h3 class='text-white font-medium mt-3'>$1</h3>")
    .replace(/^## (.*)$/gm, "<h2 class='text-white font-semibold mt-4'>$1</h2>")
    .replace(/^# (.*)$/gm, "<h1 class='text-white text-lg font-semibold mt-4'>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong class='text-white'>$1</strong>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code class='bg-white/10 px-1 rounded text-cyan-200'>$1</code>")
    .replace(/^\- (.*)$/gm, "<li>$1</li>")
    .replace(/(<li>[\s\S]+?<\/li>)/g, "<ul class='list-disc list-inside'>$1</ul>")
    .replace(/\n{2,}/g, "<br/><br/>")
    .replace(/\n/g, "<br/>");
}
