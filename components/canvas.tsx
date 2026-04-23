"use client";

/**
 * Canvas — the fullscreen morphing surface.
 *
 * Data sources:
 *   - `useSurfaces()` reads from lib/surfaces-store, a synchronous
 *     client-only store. Surfaces are kept out of useAgent().state because
 *     the SSE stream can race with parallel tool calls and stomp on local
 *     writes. The store is the single source of truth for layout.
 *   - `useAgent().state` still drives theme, subject, and selection.
 *
 * Each widget is wrapped in a hover-reveal action menu (shrink · grow ·
 * remove · more). Actions write back through `surfacesStore.set(...)` so
 * every rearrangement is a single coherent morph; the canvas animates
 * automatically via layout + spring transitions.
 */

import { useCallback, useMemo, useState } from "react";
import { useAgent } from "@copilotkit/react-core/v2";
import { AnimatePresence, motion } from "framer-motion";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { AgentSharedState, SurfaceMeta } from "@/lib/agent-state";
import A2UISurface from "./a2ui-surface";
import { renderA2UINode } from "@/lib/a2ui-render";
import { surfacesStore, useSurfaces } from "@/lib/surfaces-store";
import { SuggestionPills } from "./suggestions";

const THEME_CLASSES: Record<string, string> = {
  dark: "bg-[#0b0613] text-white",
  light: "bg-gray-50 text-gray-900",
  retro: "bg-[#1a0a00] text-[#ffb347]",
  terminal: "bg-black text-[#00ff41] font-mono",
};

export default function Canvas() {
  const { agent } = useAgent();
  const surfaces = useSurfaces();
  const agentState = agent.state as AgentSharedState | undefined;
  const selectedId = agentState?.selection?.surfaceId ?? null;
  const theme = agentState?.theme ?? "dark";
  const themeClass = THEME_CLASSES[theme] ?? THEME_CLASSES.dark;

  const removeSurface = useCallback((id: string) => {
    const cur = surfacesStore.get();
    surfacesStore.set(cur.filter((x) => x.id !== id));
  }, []);

  const resizeSurface = useCallback(
    (id: string, delta: { w?: number; h?: number }) => {
      const cur = surfacesStore.get();
      surfacesStore.set(
        cur.map((x) =>
          x.id === id
            ? ({
                ...x,
                w: clamp((x.w ?? 6) + (delta.w ?? 0), 3, 12),
                h: clamp((x.h ?? 2) + (delta.h ?? 0), 1, 6),
              } as SurfaceMeta)
            : x,
        ),
      );
    },
    [],
  );

  const selectSurface = useCallback(
    (id: string) => {
      const s = (agent.state as AgentSharedState | undefined) ?? ({} as AgentSharedState);
      const sel = s.selection;
      agent.setState({
        ...s,
        selection: sel && sel.surfaceId === id ? null : { surfaceId: id },
      } as unknown as Record<string, unknown>);
    },
    [agent],
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const cur = surfacesStore.get();
    const oldIndex = cur.findIndex((s) => s.id === active.id);
    const newIndex = cur.findIndex((s) => s.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      surfacesStore.set(arrayMove(cur, oldIndex, newIndex));
    }
  }, []);

  if (surfaces.length === 0) return <EmptyHero />;

  return (
    <div
      data-theme={theme}
      className={`morph-grid absolute inset-0 overflow-auto px-6 pt-20 pb-40 transition-colors duration-500 ${themeClass}`}
      role="region"
      aria-label="Dashboard canvas"
    >
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={surfaces.map((s) => s.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-12 gap-4 auto-rows-[minmax(120px,_auto)]">
            <AnimatePresence mode="popLayout">
              {surfaces.map((s, i) => (
                <WidgetShell
                  key={s.id}
                  surface={s}
                  index={i}
                  selected={selectedId === s.id}
                  onSelect={() => selectSurface(s.id)}
                  onRemove={() => removeSurface(s.id)}
                  onGrow={() => resizeSurface(s.id, { w: 2 })}
                  onShrink={() => resizeSurface(s.id, { w: -2 })}
                />
              ))}
            </AnimatePresence>
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function WidgetShell({
  surface,
  index,
  selected,
  onSelect,
  onRemove,
  onGrow,
  onShrink,
}: {
  surface: SurfaceMeta;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onGrow: () => void;
  onShrink: () => void;
}) {
  const w = clamp(surface.w, 3, 12);
  const h = clamp(surface.h, 1, 6);
  const isTestKpi = surface.id === "test-kpi";
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: surface.id });

  const dragStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    gridColumn: `span ${w}`,
    gridRow: `span ${h}`,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.7 : 1,
  };

  return (
    <motion.div
      ref={setNodeRef}
      layout
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{
        type: "spring",
        stiffness: 260,
        damping: 26,
        delay: Math.min(index * 0.04, 0.4),
      }}
      onClick={onSelect}
      className={`widget-card morph-glow group relative transition ${
        selected ? "ring-4 ring-cyan-300/90 shadow-[0_0_0_1px_rgba(34,211,238,0.8),0_0_32px_rgba(34,211,238,0.35)]" : "ring-0"
      } ${isDragging ? "cursor-grabbing shadow-2xl" : "cursor-default"}`}
      style={dragStyle}
      aria-label={surface.title ?? `Widget ${surface.id}`}
      role="article"
    >
      {/* Drag handle — top strip */}
      <div
        {...attributes}
        {...listeners}
        className="absolute inset-x-0 top-0 h-5 cursor-grab rounded-t-lg opacity-0 transition group-hover:opacity-100 active:cursor-grabbing"
        aria-label="Drag to reorder"
        title="Drag to reorder"
      >
        <div className="mx-auto mt-1.5 h-1 w-8 rounded-full bg-white/20" />
      </div>
      {isTestKpi ? (
        <div className="h-full w-full p-4">{renderA2UINode(surface.tree)}</div>
      ) : (
        <A2UISurface surfaceId={surface.id} />
      )}
      {selected && (
        <div className="pointer-events-none absolute left-3 top-3 z-20 max-w-[calc(100%-1.5rem)] rounded-md border border-cyan-200/40 bg-cyan-950/90 px-3 py-2 text-[11px] text-cyan-50 shadow-2xl shadow-cyan-950/50 backdrop-blur">
          <div className="flex items-center gap-2 font-semibold uppercase tracking-[0.18em]">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-200" />
            Selected widget
          </div>
          <div className="mt-1 truncate text-cyan-100/70">
            {surface.title ?? surface.id} · ask “change this to a pie chart”
          </div>
        </div>
      )}
      {surface.annotations && surface.annotations.length > 0 && (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 rounded-md border border-cyan-300/15 bg-cyan-950/70 px-2 py-1.5 text-[10px] leading-snug text-cyan-50/80 shadow-lg backdrop-blur">
          {surface.annotations.at(-1)?.text}
        </div>
      )}
      <WidgetActions
        onRemove={onRemove}
        onGrow={onGrow}
        onShrink={onShrink}
        canGrow={w < 12}
        canShrink={w > 3}
      />
    </motion.div>
  );
}

function WidgetActions({
  onRemove,
  onGrow,
  onShrink,
  canGrow,
  canShrink,
}: {
  onRemove: () => void;
  onGrow: () => void;
  onShrink: () => void;
  canGrow: boolean;
  canShrink: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="absolute right-2 top-2 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/60 p-0.5 backdrop-blur">
        <TinyBtn onClick={onShrink} disabled={!canShrink} label="Shrink">−</TinyBtn>
        <TinyBtn onClick={onGrow} disabled={!canGrow} label="Grow">+</TinyBtn>
        <TinyBtn onClick={onRemove} label="Remove" tone="rose">
          ✕
        </TinyBtn>
        <button
          type="button"
          aria-label="More actions"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="rounded px-1.5 text-xs text-white/60 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
        >
          ⋯
        </button>
      </div>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute right-0 top-9 w-44 rounded-lg border border-white/10 bg-black/80 p-1 text-xs shadow-xl backdrop-blur"
        >
          <MenuItem onClick={onRemove}>Remove widget</MenuItem>
          <MenuItem onClick={onGrow} disabled={!canGrow}>Grow wider</MenuItem>
          <MenuItem onClick={onShrink} disabled={!canShrink}>Shrink</MenuItem>
        </motion.div>
      )}
    </div>
  );
}

function TinyBtn({
  children,
  onClick,
  label,
  disabled,
  tone,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  disabled?: boolean;
  tone?: "rose";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`flex h-6 w-6 items-center justify-center rounded text-xs transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
        disabled
          ? "cursor-not-allowed text-white/20"
          : tone === "rose"
            ? "text-rose-200 hover:bg-rose-500/20"
            : "text-white/70 hover:bg-white/10 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function MenuItem({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="block w-full rounded px-2 py-1.5 text-left text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function clamp(n: number | undefined, min: number, max: number): number {
  if (typeof n !== "number") return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function EmptyHero() {
  const { agent } = useAgent();
  const agentState = agent.state as AgentSharedState | undefined;
  const theme = agentState?.theme ?? "dark";
  const themeClass = THEME_CLASSES[theme] ?? THEME_CLASSES.dark;
  const muted = theme === "light" ? "text-gray-500" : "text-white/40";
  const body = theme === "light" ? "text-gray-600" : "text-white/55";
  const heading =
    theme === "light"
      ? "bg-gradient-to-br from-gray-950 via-gray-800 to-gray-500"
      : "bg-gradient-to-br from-white via-white/90 to-white/50";
  const hints = useMemo(
    () => [
      { k: "⌘K", v: "focus" },
      { k: "⌘/", v: "chat" },
      { k: "⌘B", v: "history" },
      { k: "drop", v: "CSV / JSON" },
      { k: "🎙", v: "speak" },
    ],
    [],
  );
  return (
    <div
      data-theme={theme}
      className={`morph-grid absolute inset-0 flex flex-col items-center justify-center px-6 pt-14 transition-colors duration-500 ${themeClass}`}
      role="region"
      aria-label="Empty dashboard canvas"
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center"
      >
        <div className={`text-[10px] uppercase tracking-[0.4em] ${muted}`}>
          MorphBoard Studio
        </div>
        <h1 className={`mt-3 bg-clip-text text-6xl font-semibold leading-tight text-transparent ${heading}`}>
          Build the answer.
        </h1>
        <p className={`mx-auto mt-4 max-w-xl text-base ${body}`}>
          Ask about a repo, dataset, file, URL, or product idea. The agent can analyze
          evidence, run local Python profiling, fetch grounded context, and build live charts.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="pointer-events-auto mt-8 max-w-2xl"
      >
        <SuggestionPills max={4} className="justify-center" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className={`mt-10 flex flex-wrap items-center justify-center gap-2 text-[11px] ${theme === "light" ? "text-gray-500" : "text-white/35"}`}
      >
        {hints.map((h, i) => (
          <span key={i} className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${theme === "light" ? "border-gray-300 bg-white/70" : "border-white/10 bg-white/[0.03]"}`}>
            <kbd className={`font-mono ${theme === "light" ? "text-gray-800" : "text-white/70"}`}>{h.k}</kbd>
            <span>{h.v}</span>
          </span>
        ))}
      </motion.div>
    </div>
  );
}
