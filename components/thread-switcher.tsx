"use client";

/**
 * ThreadSwitcher — the left-rail list of past dashboards.
 *
 * VERIFIED against @copilotkit/react-core@1.56.2 .d.cts on Apr 19, 2026:
 *
 *   interface UseThreadsInput {
 *     agentId: string;
 *     includeArchived?: boolean;
 *     limit?: number;
 *   }
 *   interface UseThreadsResult {
 *     threads: Thread[];  // platform threads — empty on self-hosted runs
 *     isLoading, error, hasMoreThreads, isFetchingMoreThreads,
 *     fetchMoreThreads, renameThread, archiveThread, deleteThread
 *   }
 *
 * useThreads hits the Intelligence platform's WebSocket; self-hosted local LLM
 * deployments won't have that, so we fall back to a local thread store
 * (lib/thread-store.ts) for offline-only UX. Platform threads, when
 * present, are merged in and shown first.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAgent, useThreads } from "@copilotkit/react-core/v2";
import { motion, AnimatePresence } from "framer-motion";
import { threadStore, type LocalThread, autoNameFromMessages } from "@/lib/thread-store";
import { DEFAULT_STATE, type AgentSharedState, type SurfaceMeta } from "@/lib/agent-state";
import { surfacesStore } from "@/lib/surfaces-store";

interface UnifiedThread {
  id: string;
  name: string;
  subtitle?: string;
  updatedAt: string;
  source: "platform" | "local";
  raw?: LocalThread;
}

export default function ThreadSwitcher({
  activeThreadId,
  onSelect,
  onNew,
}: {
  activeThreadId: string | null;
  onSelect: (id: string, thread?: LocalThread) => void;
  onNew: () => void;
}) {
  // useThreads is safe to call even when the platform is absent — it just
  // returns an empty list and error=null.
  const platform = useThreads({ agentId: "default", limit: 30 });
  const [local, setLocal] = useState<LocalThread[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  // Seed + subscribe to local store.
  useEffect(() => {
    setLocal(threadStore.list());
    return threadStore.subscribe(() => setLocal(threadStore.list()));
  }, []);

  const unified = useMemo<UnifiedThread[]>(() => {
    const fromPlatform: UnifiedThread[] = (platform.threads ?? []).map((t) => ({
      id: t.id,
      name: t.name ?? "Untitled",
      subtitle: new Date(t.updatedAt).toLocaleString(),
      updatedAt: t.updatedAt,
      source: "platform" as const,
    }));
    const fromLocal: UnifiedThread[] = local.map((t) => ({
      id: t.id,
      name: t.name ?? "Untitled",
      subtitle: [t.subject, `${t.messageCount} msg`].filter(Boolean).join(" · "),
      updatedAt: t.updatedAt,
      source: "local" as const,
      raw: t,
    }));
    // De-dupe — platform wins on collision.
    const platformIds = new Set(fromPlatform.map((t) => t.id));
    return [...fromPlatform, ...fromLocal.filter((t) => !platformIds.has(t.id))]
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
      .slice(0, 40);
  }, [platform.threads, local]);

  const commitRename = useCallback(
    async (id: string) => {
      const name = renameDraft.trim();
      if (!name) {
        setRenamingId(null);
        return;
      }
      const hit = unified.find((t) => t.id === id);
      if (hit?.source === "platform") {
        try {
          await platform.renameThread(id, name);
        } catch {/* platform error — fall through to local mirror if present */}
      }
      if (hit?.source === "local" || threadStore.get(id)) {
        threadStore.rename(id, name);
      }
      setRenamingId(null);
    },
    [renameDraft, unified, platform],
  );

  const onDelete = useCallback(
    async (id: string) => {
      const hit = unified.find((t) => t.id === id);
      if (hit?.source === "platform") {
        try { await platform.deleteThread(id); } catch {/* ignore */}
      }
      threadStore.delete(id);
    },
    [unified, platform],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <span className="text-[10px] uppercase tracking-[0.3em] text-white/40">sessions</span>
        <button
          type="button"
          onClick={onNew}
          aria-label="New session"
          className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/80 transition hover:border-violet-400/60 hover:text-white"
        >
          + new
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {platform.isLoading && (
          <div className="px-3 py-2 text-xs text-white/40">loading…</div>
        )}
        {unified.length === 0 && !platform.isLoading && (
          <div className="px-3 py-2 text-xs text-white/40">
            No saved sessions yet. Your next conversation will appear here.
          </div>
        )}

        <ul className="flex flex-col gap-1">
          <AnimatePresence initial={false}>
            {unified.map((t) => {
              const active = t.id === activeThreadId;
              const isRenaming = renamingId === t.id;
              return (
                <motion.li
                  key={t.id}
                  layout
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -4 }}
                  className={`group relative rounded-lg border px-3 py-2 text-xs transition ${
                    active
                      ? "border-violet-400/50 bg-violet-500/10 text-white"
                      : "border-transparent bg-white/[0.02] text-white/70 hover:border-white/10 hover:bg-white/[0.04]"
                  }`}
                >
                  <button
                    type="button"
                    className="flex w-full flex-col items-start gap-0.5 pr-10 text-left"
                    onDoubleClick={() => {
                      setRenameDraft(t.name);
                      setRenamingId(t.id);
                    }}
                    onClick={() => !isRenaming && onSelect(t.id, t.raw)}
                  >
                    {isRenaming ? (
                      <input
                        autoFocus
                        value={renameDraft}
                        onChange={(e) => setRenameDraft(e.target.value)}
                        onBlur={() => commitRename(t.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRename(t.id);
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        className="w-full rounded bg-black/40 px-1.5 py-0.5 text-xs text-white outline-none ring-1 ring-violet-400/50"
                      />
                    ) : (
                      <span className="truncate font-medium">{t.name}</span>
                    )}
                    {t.subtitle && !isRenaming && (
                      <span className="truncate text-[10px] text-white/40">{t.subtitle}</span>
                    )}
                  </button>
                  {!isRenaming && (
                    <div className="absolute right-1 top-1.5 hidden gap-1 group-hover:flex">
                      <button
                        type="button"
                        aria-label="Rename session"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenameDraft(t.name);
                          setRenamingId(t.id);
                        }}
                        className="rounded p-1 text-white/40 hover:bg-white/5 hover:text-white"
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        aria-label="Delete session"
                        onClick={(e) => {
                          e.stopPropagation();
                          void onDelete(t.id);
                        }}
                        className="rounded p-1 text-white/40 hover:bg-rose-500/20 hover:text-rose-200"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      </div>
    </div>
  );
}

/**
 * ThreadPersister — keeps the local thread store in sync with the current
 * agent. Mount once near the top of the tree. It auto-creates a new thread
 * on first user message and snapshots state/messages on every change.
 */
export function ThreadPersister({
  threadId,
  onCreateNew,
}: {
  threadId: string;
  onCreateNew?: (id: string) => void;
}) {
  const { agent } = useAgent();

  useEffect(() => {
    let cancelled = false;

    // On mount: if a stored thread exists for this id, restore its state +
    // surfaces. The surfaces live in a separate client store because the
    // agent SSE stream can race with parallel tool calls.
    const stored = threadStore.get(threadId);
    if (stored?.state) {
      try {
        agent.setState(stored.state as Record<string, unknown>);
      } catch {/* state shape drift — ignore */}
    }
    if (Array.isArray(stored?.surfaces)) {
      try {
        surfacesStore.set(stored.surfaces as SurfaceMeta[]);
      } catch {/* ignore */}
    } else if (!stored) {
      // Starting a fresh thread — clear any stale surfaces from the previous one.
      surfacesStore.set([]);
    }

    // Subscribe to agent changes AND surface-store changes — surfaces live
    // outside agent.state so onStateChanged alone wouldn't catch them.
    const sub = agent.subscribe({
      onMessagesChanged: () => snapshot(),
      onStateChanged: () => snapshot(),
    });
    const unsubSurfaces = surfacesStore.subscribe(() => snapshot());

    function snapshot() {
      if (cancelled) return;
      // Read current messages from the agent. AbstractAgent exposes
      // `messages` via its state machine; we tolerate either shape.
      const maybeMessages =
        (agent as unknown as { messages?: { id: string; role: string; content?: unknown }[] }).messages ?? [];
      const messages = maybeMessages.map((m) => ({
        id: m.id,
        role: (m.role as "user" | "assistant" | "system" | "tool") ?? "assistant",
        content: typeof m.content === "string" ? m.content : JSON.stringify(m.content ?? ""),
        createdAt: new Date().toISOString(),
      }));
      const state = (agent.state ?? DEFAULT_STATE) as AgentSharedState;
      const existing = threadStore.get(threadId);
      const autoName = autoNameFromMessages(messages);
      const rec: LocalThread = {
        id: threadId,
        name: existing?.name ?? autoName ?? null,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        subject: state?.subject,
        messageCount: messages.length,
        surfaces: surfacesStore.get(), // snapshot the actual live surfaces
        state,
        messages,
      };
      threadStore.upsert(rec);
      if (!existing && onCreateNew) onCreateNew(threadId);
    }

    return () => {
      cancelled = true;
      try {
        (sub as { unsubscribe?: () => void } | void)?.unsubscribe?.();
      } catch {/* noop */}
      try {
        unsubSurfaces();
      } catch {/* noop */}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  return null;
}
