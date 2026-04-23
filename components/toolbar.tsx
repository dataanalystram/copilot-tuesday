"use client";

/**
 * Toolbar — the top-of-canvas chrome.
 *
 * Left:  Studio wordmark + live subject breadcrumb (e.g. "vercel/next.js").
 * Center: live tool-call ticker (pulled from the agent's in-flight tool calls).
 * Right: theme cycle, share-snapshot, export JSON, toggle sessions rail,
 *        toggle chat rail.
 *
 * All buttons have visible focus rings and aria-labels. Keyboard shortcuts
 * live in `components/shortcuts.tsx` — this file just renders the hints.
 */

import { useCallback, useEffect, useState } from "react";
import { useAgent } from "@copilotkit/react-core/v2";
import { motion } from "framer-motion";
import type { AgentSharedState, Theme } from "@/lib/agent-state";
import { useSurfaces } from "@/lib/surfaces-store";

const THEME_ORDER: Theme[] = ["dark", "light", "retro", "terminal"];

export default function Toolbar({
  onToggleChat,
  onToggleSessions,
  chatOpen,
  sessionsOpen,
}: {
  onToggleChat: () => void;
  onToggleSessions: () => void;
  chatOpen: boolean;
  sessionsOpen: boolean;
}) {
  const { agent } = useAgent();
  const state = (agent.state as AgentSharedState | undefined) ?? undefined;
  const surfaces = useSurfaces();
  const [running, setRunning] = useState(false);

  // Subscribe to run status — we don't get it from useAgent by default unless
  // updates include OnRunStatusChanged. Fall back to polling isRunning.
  useEffect(() => {
    const sub = agent.subscribe({
      onRunInitialized: () => setRunning(true),
      onRunFinalized: () => setRunning(false),
      onRunFailed: () => setRunning(false),
    });
    setRunning(agent.isRunning);
    return () => {
      try {
        (sub as { unsubscribe?: () => void })?.unsubscribe?.();
      } catch {/* noop */}
    };
  }, [agent]);

  const cycleTheme = useCallback(() => {
    const cur = (state?.theme ?? "dark") as Theme;
    const i = THEME_ORDER.indexOf(cur);
    const next = THEME_ORDER[(i + 1) % THEME_ORDER.length];
    agent.setState({
      ...(state ?? {}),
      theme: next,
    } as unknown as Record<string, unknown>);
  }, [agent, state]);

  const exportJson = useCallback(() => {
    // Surfaces live in the client-only surfacesStore, not agent.state — so we
    // compose the export payload from both sources. This matches what the
    // ThreadPersister snapshots and what the share link encodes.
    const payload = { state: state ?? {}, surfaces };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `morphboard-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [state, surfaces]);

  const [shareCopied, setShareCopied] = useState(false);
  const copyShareLink = useCallback(async () => {
    try {
      // btoa can't handle multibyte UTF-8 directly, so encodeURIComponent first.
      const payload = btoa(encodeURIComponent(JSON.stringify(surfaces)));
      const url = new URL(window.location.href);
      url.searchParams.set("snapshot", payload);
      await navigator.clipboard.writeText(url.toString());
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 1400);
    } catch {/* clipboard denied */}
  }, [surfaces]);

  const subject = state?.subject ?? null;
  const stage = state?.stage ?? "intake";

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 border-b border-white/5 bg-black/40 px-4 backdrop-blur-xl pl-36"
      role="banner"
    >
      <button
        type="button"
        onClick={onToggleSessions}
        aria-label={sessionsOpen ? "Hide sessions" : "Show sessions"}
        aria-pressed={sessionsOpen}
        className="flex h-9 w-9 items-center justify-center rounded-md text-white/70 transition hover:bg-white/5 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className={`absolute inset-0 rounded-full ${running ? "bg-violet-400 animate-ping" : "bg-violet-400/60"}`} />
          <span className="relative h-2 w-2 rounded-full bg-violet-400" />
        </span>
        <span className="font-mono text-sm text-white/90">MorphBoard Studio</span>
        {subject && (
          <>
            <span className="text-white/20">/</span>
            <span className="truncate font-mono text-sm text-white/60">{subject}</span>
          </>
        )}
        <span className="hidden rounded-full border border-cyan-300/15 bg-cyan-300/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-cyan-100/65 sm:inline-flex">
          {stage}
        </span>
      </div>

      <div className="flex-1" />

      <ToolbarButton onClick={cycleTheme} label={`Theme: ${state?.theme ?? "dark"}`}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      </ToolbarButton>

      <ToolbarButton
        onClick={copyShareLink}
        label={shareCopied ? "Snapshot link copied" : "Copy shareable snapshot link"}
        pressed={shareCopied}
      >
        {shareCopied ? (
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 6L9 17l-5-5" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <path d="M8.6 10.5l6.8-4M8.6 13.5l6.8 4" />
          </svg>
        )}
      </ToolbarButton>

      <ToolbarButton onClick={exportJson} label="Export dashboard JSON">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <path d="M7 10l5 5 5-5" />
          <path d="M12 15V3" />
        </svg>
      </ToolbarButton>

      <div className="mx-1 h-5 w-px bg-white/10" aria-hidden />

      <ToolbarButton
        onClick={onToggleChat}
        label={chatOpen ? "Hide chat" : "Show chat"}
        pressed={chatOpen}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </ToolbarButton>
    </motion.header>
  );
}

function ToolbarButton({
  children,
  onClick,
  label,
  pressed,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className={`flex h-9 w-9 items-center justify-center rounded-md border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
        pressed
          ? "border-violet-400/40 bg-violet-500/10 text-violet-100"
          : "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20 hover:bg-white/5 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}
