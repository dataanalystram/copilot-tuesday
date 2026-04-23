"use client";

import Image from "next/image";

export interface MediaCardProps {
  title?: string;
  src: string;
  alt?: string;
  caption?: string;
  sourceUrl?: string;
}

export function MediaCard({ title, src, alt, caption, sourceUrl }: MediaCardProps) {
  const media = (
    <Image
      src={src}
      alt={alt ?? title ?? "Generated media"}
      fill
      sizes="(max-width: 768px) 100vw, 50vw"
      unoptimized
      className="object-cover"
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {title && <div className="mb-2 text-[11px] uppercase tracking-widest opacity-60">{title}</div>}
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-md border border-white/8 bg-white/[0.035]">
        {sourceUrl ? (
          <a href={sourceUrl} target="_blank" rel="noreferrer" className="block h-full w-full">
            {media}
          </a>
        ) : (
          media
        )}
      </div>
      {caption && <div className="mt-2 text-xs leading-snug text-white/55">{caption}</div>}
    </div>
  );
}
