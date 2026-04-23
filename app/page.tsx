"use client";

/**
 * MorphBoard — fullscreen generative-UI dashboard.
 *
 * This file is the composition root. Everything below <CopilotKit> is client-
 * side; the CopilotKit provider wires the A2UI message renderer and the local
 * Ollama/Qwen-backed AG-UI agent running at /api/copilotkit.
 *
 * CopilotKit v2 primitives used (every one verified against the installed
 * @copilotkit/react-core@1.56.2 .d.cts types on Apr 19, 2026):
 *   - CopilotKit (v2 provider; takes `agent`, `runtimeUrl`,
 *     `renderActivityMessages` — verified in copilotkit-BtP7w7cT.d.cts)
 *   - createA2UIMessageRenderer (from @copilotkit/a2ui-renderer, re-exported
 *     from @copilotkit/react-core/v2). Returns ONE renderer.
 *   - renderActivityMessages: ReactActivityMessageRenderer<any>[] — an ARRAY.
 *   - useAgent, useFrontendTool, useInterrupt, useHumanInTheLoop,
 *     useAttachments, useSuggestions, useConfigureSuggestions,
 *     useAgentContext, useRenderTool, useThreads, useComponent,
 *     CopilotKitInspector — all mounted by the feature modules below.
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────┐
 *   │ Toolbar                                          │
 *   ├────────────┬─────────────────────┬───────────────┤
 *   │ SessionsRl │  Canvas (A2UI grid) │  ChatRail     │
 *   │ (history)  │                     │  (transcript) │
 *   │            │                     │               │
 *   ├────────────┴─────────────────────┴───────────────┤
 *   │ CommandBar (always-visible morph composer)       │
 *   └──────────────────────────────────────────────────┘
 *
 * The whole thing is wrapped in AttachmentDropzone so CSV / JSON / images
 * can be dropped anywhere on the window.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { CopilotKit, createA2UIMessageRenderer } from "@copilotkit/react-core/v2";

import Canvas from "@/components/canvas";
import CommandBar from "@/components/command-bar";
import Toolbar from "@/components/toolbar";
import ChatRail from "@/components/chat-rail";
import SessionsRail from "@/components/sessions-rail";
import AttachmentDropzone from "@/components/attachment-dropzone";

import AgentState from "@/components/agent-state";
import WidgetRegistry from "@/components/widget-registry";
import FrontendTools from "@/components/frontend-tools";
import AgentContext from "@/components/agent-context";
import ToolCallChips from "@/components/tool-call-chip";
import Suggestions from "@/components/suggestions";
import ResearchSync from "@/components/research-sync";
import DataTransformSync from "@/components/data-transform-sync";
import InspectorToggle from "@/components/inspector-toggle";
import Shortcuts, { useShortcut } from "@/components/shortcuts";
import { ThreadPersister } from "@/components/thread-switcher";

import { makeThreadId } from "@/lib/thread-store";
import { surfacesStore } from "@/lib/surfaces-store";

// The A2UI renderer parses streaming A2UI events from the agent and turns
// them into a React tree. `theme` is a token-bag (Record<string, unknown>)
// in the v0.9 spec; we pass an empty object and let the server-side
// `createSurface` messages attach specific themes. Declared at module scope
// so the reference is stable across renders.
const a2uiRenderer = createA2UIMessageRenderer({ theme: {} });
const activityRenderers = [a2uiRenderer];

export default function Home() {
  return (
    <CopilotKit
      runtimeUrl="/api/copilotkit"
      agent="default"
      renderActivityMessages={activityRenderers}
    >
      <AppShell />
    </CopilotKit>
  );
}

/**
 * AppShell — owns ephemeral UI state (which rails are open, which thread is
 * active). Kept inside <CopilotKit> so every child can use hooks like
 * useAgent/useThreads without a second provider.
 */
function AppShell() {
  const [threadId, setThreadId] = useState<string>(() => makeThreadId());
  const [chatOpen, setChatOpen] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const didRestoreSnapshotRef = useRef(false);

  // ----- snapshot deep-link: ?snapshot=<base64(JSON(SurfaceMeta[]))> -----
  useEffect(() => {
    if (didRestoreSnapshotRef.current) return;
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const snap = url.searchParams.get("snapshot");
    if (!snap) return;
    try {
      const json = decodeURIComponent(atob(snap));
      const surfaces = JSON.parse(json);
      if (Array.isArray(surfaces)) {
        surfacesStore.set(surfaces);
      }
      // Clean the URL so refreshes don't re-inject the snapshot over live edits.
      url.searchParams.delete("snapshot");
      window.history.replaceState({}, "", url.toString());
    } catch {
      /* bad payload — ignore */
    } finally {
      didRestoreSnapshotRef.current = true;
    }
  }, []);

  // ----- keyboard shortcut wiring -----
  useShortcut("toggle-chat", useCallback(() => setChatOpen((v) => !v), []));
  useShortcut("toggle-sessions", useCallback(() => setSessionsOpen((v) => !v), []));
  useShortcut(
    "close-all",
    useCallback(() => {
      setChatOpen(false);
      setSessionsOpen(false);
    }, []),
  );

  // ----- thread management -----
  const onSelectThread = useCallback((id: string) => {
    // Swapping threadId triggers ThreadPersister's effect which restores
    // state + surfaces from the local store in a single coherent morph.
    setThreadId(id);
  }, []);

  const onNewThread = useCallback(() => {
    setThreadId(makeThreadId());
    // Surfaces are cleared inside ThreadPersister when no stored thread exists
    // for the new id; we also proactively clear here for snappier UX.
    surfacesStore.set([]);
  }, []);

  return (
    <>
      {/*
        ZERO-RENDER helpers (all return null) — these register hooks with
        CopilotKit so the agent has the tools, context, suggestions, and
        components it needs. Order doesn't matter; they're independent.
      */}
      <AgentState />
      <WidgetRegistry />
      <FrontendTools />
      <AgentContext />
      <ToolCallChips />
      <Suggestions />
      <ResearchSync />
      <DataTransformSync />
      <Shortcuts />
      <InspectorToggle />
      <ThreadPersister threadId={threadId} />

      <main className="relative h-screen w-screen overflow-hidden bg-[#0b0613] text-white">
        {/* Toolbar pins to the top; bottom area scrolls. */}
        <Toolbar
          chatOpen={chatOpen}
          sessionsOpen={sessionsOpen}
          onToggleChat={() => setChatOpen((v) => !v)}
          onToggleSessions={() => setSessionsOpen((v) => !v)}
        />

        {/* AttachmentDropzone covers the full window so users can drop files
            onto the canvas, the chat rail, anywhere. */}
        <AttachmentDropzone>
          <Canvas />

          {/* The rails float over the canvas; they're in <aside> elements with
              explicit aria-labels for screen-reader navigation. */}
          <SessionsRail
            open={sessionsOpen}
            onClose={() => setSessionsOpen(false)}
            activeThreadId={threadId}
            onSelect={onSelectThread}
            onNew={onNewThread}
          />
          <ChatRail open={chatOpen} onClose={() => setChatOpen(false)} />

          {/* Always-on command bar. Auto-opens the chat rail on first send so
              the user sees the assistant's reply without hunting. */}
          <CommandBar onSend={() => setChatOpen(true)} />
        </AttachmentDropzone>
      </main>
    </>
  );
}
