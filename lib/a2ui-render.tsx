"use client";

/**
 * Tiny renderer for our A2UINode tree.
 *
 * This walks the tree the agent declared in useAgent state and turns it
 * into React. Custom widgets (KPI, Chart, Globe) are mounted by name
 * against the registry set up via useComponent.
 *
 * We keep this minimal on purpose — the heavy lifting of A2UI streaming
 * parsing lives in @copilotkit/a2ui-renderer for chat messages. For the
 * dashboard grid, a lean dispatcher is simpler and faster.
 */

import React from "react";
import { useAgent } from "@copilotkit/react-core/v2";
import type { A2UINode } from "./agent-state";
import { COMPONENT_REGISTRY } from "@/components/widget-registry";

export function renderA2UINode(node: A2UINode, key?: React.Key): React.ReactNode {
  if (!node) return null;
  switch (node.type) {
    case "Column":
      return (
        <div key={key} className={`flex flex-col ${gapClass(node.gap ?? 2)}`}>
          {node.children.map((c, i) => renderA2UINode(c, i))}
        </div>
      );
    case "Row":
      return (
        <div key={key} className={`flex items-center ${gapClass(node.gap ?? 2)}`}>
          {node.children.map((c, i) => renderA2UINode(c, i))}
        </div>
      );
    case "Text":
      return <TextNode key={key} text={node.text} variant={node.variant ?? "body"} />;
    case "Badge":
      return <BadgeNode key={key} text={node.text} tone={node.tone ?? "neutral"} />;
    case "Divider":
      return <div key={key} className="h-px w-full bg-white/10 my-2" />;
    case "Button":
      return <ButtonNode key={key} text={node.text} actionId={node.actionId} tone={node.tone ?? "primary"} />;
    case "Component": {
      const Comp = COMPONENT_REGISTRY[node.name];
      if (!Comp) {
        return (
          <div key={key} className="rounded bg-red-500/10 border border-red-500/30 p-3 text-red-300 text-xs">
            Unknown widget: {node.name}
          </div>
        );
      }
      return <Comp key={key} {...(node.props as Record<string, unknown>)} />;
    }
  }
}

function gapClass(n: number): string {
  const g: Record<number, string> = { 0: "gap-0", 1: "gap-1", 2: "gap-2", 3: "gap-3", 4: "gap-4", 6: "gap-6" };
  return g[n] ?? "gap-2";
}

function TextNode({ text, variant }: { text: string; variant: "heading" | "subtitle" | "body" | "mono" }) {
  const cls = {
    heading: "text-xl font-semibold text-white",
    subtitle: "text-sm uppercase tracking-wider text-white/50",
    body: "text-sm text-white/80",
    mono: "font-mono text-xs text-white/70",
  }[variant];
  return <div className={cls}>{text}</div>;
}

function BadgeNode({ text, tone }: { text: string; tone: "neutral" | "success" | "warning" | "danger" | "accent" }) {
  const tones = {
    neutral: "bg-white/10 text-white/70",
    success: "bg-emerald-500/15 text-emerald-300",
    warning: "bg-amber-500/15 text-amber-200",
    danger: "bg-rose-500/15 text-rose-300",
    accent: "bg-violet-500/20 text-violet-200",
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${tones[tone]}`}>{text}</span>;
}

function ButtonNode({ text, actionId, tone }: { text: string; actionId: string; tone: "primary" | "ghost" }) {
  // useAgent() -> { agent }. AbstractAgent.addMessage(message) takes a
  // fully-formed Message with an `id` (required in @ag-ui/core Message
  // schemas). We generate a UUID here so the schema validates.
  const { agent } = useAgent();
  const base = "px-3 py-1.5 rounded-md text-sm transition";
  const cls =
    tone === "primary"
      ? "bg-violet-500/90 hover:bg-violet-500 text-white"
      : "bg-white/5 hover:bg-white/10 text-white/80";
  return (
    <button
      className={`${base} ${cls}`}
      onClick={() => {
        // Round-trip: user click -> agent gets a user-turn message describing the action.
        // This matches A2UI's userAction semantics (see Google A2UI spec).
        const id =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        agent.addMessage({
          id,
          role: "user",
          content: `[userAction] ${actionId}`,
        });
        // Kick the agent so it processes the new user turn.
        void agent.runAgent();
      }}
    >
      {text}
    </button>
  );
}
